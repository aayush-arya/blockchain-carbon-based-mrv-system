import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { db, closeDatabaseConnection } from '../src/db/client';
import { getTestImage, type TestImageKey } from './fixtures/testImages';

const app = createApp();
const testEmails: string[] = [];

function uniqueEmail(prefix: string): string {
  const email = `test-mrv-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  testEmails.push(email);
  return email;
}

async function registerAs(role: 'field_operator' | 'validator'): Promise<{ userId: string; accessToken: string }> {
  const email = uniqueEmail(role);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'correct-horse-1', fullName: `MRV Test ${role}` });
  const userId = res.body.user.id as string;

  if (role === 'validator') {
    await db.updateTable('users').set({ role: 'validator' }).where('id', '=', userId).execute();
    const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'correct-horse-1' });
    return { userId, accessToken: loginRes.body.tokens.accessToken };
  }

  return { userId, accessToken: res.body.tokens.accessToken };
}

async function createObservation(
  accessToken: string,
  imageKey: TestImageKey,
  overrides: { latitude?: string; longitude?: string; capturedAt?: string; ecosystemCode?: string } = {}
): Promise<string> {
  const res = await request(app)
    .post('/api/observations')
    .set('Authorization', `Bearer ${accessToken}`)
    .field('ecosystemCode', overrides.ecosystemCode ?? 'mangrove')
    .field('latitude', overrides.latitude ?? '22.35')
    .field('longitude', overrides.longitude ?? '89.18')
    .field('capturedAt', overrides.capturedAt ?? new Date().toISOString())
    .field('reportedAreaM2', '100')
    .attach('image', getTestImage(imageKey), { filename: 'evidence.jpg', contentType: 'image/jpeg' });
  return res.body.observationId as string;
}

describe('MRV record lifecycle', () => {
  afterAll(async () => {
    if (testEmails.length > 0) {
      const userIds = db.selectFrom('users').select('id').where('email', 'in', testEmails);
      const observationIds = db
        .selectFrom('field_observations')
        .select('id')
        .where('contributor_id', 'in', userIds);

      // Deletion order follows the FK graph: mrv_records is ON DELETE RESTRICT from
      // field_observations (by design - MRV history is never cascade-deleted), and
      // validation_events/blockchain_assets cascade from mrv_records.
      await db.deleteFrom('mrv_records').where('observation_id', 'in', observationIds).execute();
      await db.deleteFrom('field_observations').where('contributor_id', 'in', userIds).execute();
      await db.deleteFrom('users').where('email', 'in', testEmails).execute();
    }
    await closeDatabaseConnection();
  });

  it('walks a record through draft -> submitted -> ai_analyzed -> pending_validation -> verified', async () => {
    const operator = await registerAs('field_operator');
    const validator = await registerAs('validator');
    const observationId = await createObservation(operator.accessToken, 'A');

    const created = await request(app)
      .post('/api/mrv')
      .set('Authorization', `Bearer ${operator.accessToken}`)
      .send({ observationId });
    expect(created.status).toBe(201);
    const mrvId = created.body.mrvRecord.id as string;
    expect(created.body.mrvRecord.mrv_code).toMatch(/^MRV-\d{6}$/);

    const submit = await request(app)
      .post(`/api/mrv/${mrvId}/submit`)
      .set('Authorization', `Bearer ${operator.accessToken}`);
    expect(submit.status).toBe(200);
    expect(submit.body.status).toBe('submitted');

    const analyze = await request(app)
      .post(`/api/mrv/${mrvId}/analyze`)
      .set('Authorization', `Bearer ${operator.accessToken}`);
    expect(analyze.status).toBe(200);
    expect(analyze.body.status).toBe('ai_analyzed');
    expect(['mangrove', 'seagrass', 'salt_marsh']).toContain(analyze.body.analysis.predictedEcosystem);
    expect(analyze.body.analysis.modelMode).toBe('heuristic');

    const calculate = await request(app)
      .post(`/api/mrv/${mrvId}/calculate`)
      .set('Authorization', `Bearer ${operator.accessToken}`);
    expect(calculate.status).toBe(200);
    expect(calculate.body.status).toBe('pending_validation');
    expect(calculate.body.breakdown.estimated_carbon_tco2e).toBeGreaterThanOrEqual(0);
    expect(calculate.body.duplicates).toEqual([]);

    const approve = await request(app)
      .post(`/api/validation/${mrvId}/approve`)
      .set('Authorization', `Bearer ${validator.accessToken}`)
      .send({ reason: 'Looks good' });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('verified');

    const detail = await request(app)
      .get(`/api/mrv/${mrvId}`)
      .set('Authorization', `Bearer ${operator.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.mrvRecord.status).toBe('verified');
    expect(detail.body.mrvRecord.observation.id).toBe(observationId);
    expect(detail.body.mrvRecord.aiAnalysis).not.toBeNull();
    expect(detail.body.mrvRecord.validationEvents).toHaveLength(1);
    expect(detail.body.mrvRecord.validationEvents[0].action).toBe('approve');
    expect(detail.body.mrvRecord.calculation_breakdown.formula).toContain('ANNUAL');
  });

  it('rejects invalid state transitions with 409', async () => {
    const operator = await registerAs('field_operator');
    const observationId = await createObservation(operator.accessToken, 'B');
    const created = await request(app)
      .post('/api/mrv')
      .set('Authorization', `Bearer ${operator.accessToken}`)
      .send({ observationId });
    const mrvId = created.body.mrvRecord.id as string;

    // Skipping straight to /analyze while still in draft should fail - only submitted -> ai_analyzed is valid.
    const badAnalyze = await request(app)
      .post(`/api/mrv/${mrvId}/analyze`)
      .set('Authorization', `Bearer ${operator.accessToken}`);
    expect(badAnalyze.status).toBe(409);

    await request(app).post(`/api/mrv/${mrvId}/submit`).set('Authorization', `Bearer ${operator.accessToken}`);

    // Submitting again should fail - already submitted.
    const doubleSubmit = await request(app)
      .post(`/api/mrv/${mrvId}/submit`)
      .set('Authorization', `Bearer ${operator.accessToken}`);
    expect(doubleSubmit.status).toBe(409);
  });

  it('supports the rejection path with a required reason', async () => {
    const operator = await registerAs('field_operator');
    const validator = await registerAs('validator');
    const observationId = await createObservation(operator.accessToken, 'C');
    const created = await request(app)
      .post('/api/mrv')
      .set('Authorization', `Bearer ${operator.accessToken}`)
      .send({ observationId });
    const mrvId = created.body.mrvRecord.id as string;

    await request(app).post(`/api/mrv/${mrvId}/submit`).set('Authorization', `Bearer ${operator.accessToken}`);
    await request(app).post(`/api/mrv/${mrvId}/analyze`).set('Authorization', `Bearer ${operator.accessToken}`);
    await request(app).post(`/api/mrv/${mrvId}/calculate`).set('Authorization', `Bearer ${operator.accessToken}`);

    const missingReason = await request(app)
      .post(`/api/validation/${mrvId}/reject`)
      .set('Authorization', `Bearer ${validator.accessToken}`)
      .send({});
    expect(missingReason.status).toBe(400);

    const reject = await request(app)
      .post(`/api/validation/${mrvId}/reject`)
      .set('Authorization', `Bearer ${validator.accessToken}`)
      .send({ reason: 'Evidence image is unusable' });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe('rejected');
  });

  it('blocks a field_operator from approving/rejecting and from acting on someone else\'s draft', async () => {
    const owner = await registerAs('field_operator');
    const intruder = await registerAs('field_operator');
    const observationId = await createObservation(owner.accessToken, 'D');
    const created = await request(app)
      .post('/api/mrv')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ observationId });
    const mrvId = created.body.mrvRecord.id as string;

    const intruderSubmit = await request(app)
      .post(`/api/mrv/${mrvId}/submit`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);
    expect(intruderSubmit.status).toBe(403);

    const operatorApprove = await request(app)
      .post(`/api/validation/${mrvId}/approve`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({});
    expect(operatorApprove.status).toBe(403);
  });

  it('flags a geo+time+ecosystem proximity duplicate at calculation time', async () => {
    const operator = await registerAs('field_operator');
    const sharedTime = new Date().toISOString();

    const firstObservationId = await createObservation(operator.accessToken, 'E', {
      latitude: '10.0001',
      longitude: '77.0001',
      capturedAt: sharedTime,
      ecosystemCode: 'seagrass',
    });
    const firstMrv = await request(app)
      .post('/api/mrv')
      .set('Authorization', `Bearer ${operator.accessToken}`)
      .send({ observationId: firstObservationId });
    const firstMrvId = firstMrv.body.mrvRecord.id as string;
    await request(app).post(`/api/mrv/${firstMrvId}/submit`).set('Authorization', `Bearer ${operator.accessToken}`);
    await request(app).post(`/api/mrv/${firstMrvId}/analyze`).set('Authorization', `Bearer ${operator.accessToken}`);
    await request(app)
      .post(`/api/mrv/${firstMrvId}/calculate`)
      .set('Authorization', `Bearer ${operator.accessToken}`);

    // ~11m away (0.0001 deg latitude), same time, same ecosystem - within the 50m/48h defaults.
    const secondObservationId = await createObservation(operator.accessToken, 'F', {
      latitude: '10.0002',
      longitude: '77.0001',
      capturedAt: sharedTime,
      ecosystemCode: 'seagrass',
    });
    const secondMrv = await request(app)
      .post('/api/mrv')
      .set('Authorization', `Bearer ${operator.accessToken}`)
      .send({ observationId: secondObservationId });
    const secondMrvId = secondMrv.body.mrvRecord.id as string;
    await request(app).post(`/api/mrv/${secondMrvId}/submit`).set('Authorization', `Bearer ${operator.accessToken}`);
    await request(app).post(`/api/mrv/${secondMrvId}/analyze`).set('Authorization', `Bearer ${operator.accessToken}`);
    const secondCalculate = await request(app)
      .post(`/api/mrv/${secondMrvId}/calculate`)
      .set('Authorization', `Bearer ${operator.accessToken}`);

    expect(secondCalculate.body.duplicates.length).toBeGreaterThan(0);
    expect(secondCalculate.body.duplicates[0].matchedMrvId).toBe(firstMrvId);
    expect(secondCalculate.body.duplicates[0].type).toBe('geo_time_proximity');
  });
});
