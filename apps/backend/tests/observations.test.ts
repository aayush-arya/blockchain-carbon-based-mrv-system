import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { db, closeDatabaseConnection } from '../src/db/client';

const app = createApp();
const testEmails: string[] = [];

function uniqueEmail(): string {
  const email = `test-obs-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  testEmails.push(email);
  return email;
}

async function registerAndLogin(): Promise<{ userId: string; accessToken: string }> {
  const email = uniqueEmail();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'correct-horse-1', fullName: 'Observation Tester' });
  return { userId: res.body.user.id, accessToken: res.body.tokens.accessToken };
}

// Unique per call (not just per test file) so a rerun against the same dev database never
// collides with evidence left over from a previous run - the exact-hash duplicate check is
// real and would otherwise "correctly" fire against stale data.
function uniqueImageBytes(label: string): Buffer {
  return Buffer.from(`fake-image-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('observations + evidence', () => {
  afterAll(async () => {
    if (testEmails.length > 0) {
      // field_observations.contributor_id is ON DELETE RESTRICT by design (you shouldn't be
      // able to delete a user who has submitted observations) - evidence_files cascades from
      // field_observations, so deleting observations first is enough to then delete the users.
      await db
        .deleteFrom('field_observations')
        .where('contributor_id', 'in', db.selectFrom('users').select('id').where('email', 'in', testEmails))
        .execute();
      await db.deleteFrom('users').where('email', 'in', testEmails).execute();
    }
    await closeDatabaseConnection();
  });

  it('creates an observation with evidence and round-trips geo coordinates', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/observations')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('ecosystemCode', 'mangrove')
      .field('latitude', '22.3511')
      .field('longitude', '89.1834')
      .field('capturedAt', new Date().toISOString())
      .field('reportedAreaM2', '100')
      .field('notes', 'Test mangrove patch near the estuary mouth')
      .attach('image', uniqueImageBytes('site'), { filename: 'site.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.observationId).toBeTruthy();
    expect(res.body.duplicateWarning).toBeNull();

    const detail = await request(app)
      .get(`/api/observations/${res.body.observationId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(detail.status).toBe(200);
    expect(detail.body.observation.ecosystem_code).toBe('mangrove');
    expect(detail.body.observation.latitude).toBeCloseTo(22.3511, 4);
    expect(detail.body.observation.longitude).toBeCloseTo(89.1834, 4);
    expect(detail.body.observation.evidence).toHaveLength(1);
    expect(detail.body.observation.evidence[0].sha256_hash).toBe(res.body.sha256);
  });

  it('rejects observation creation without an image', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/observations')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('ecosystemCode', 'seagrass')
      .field('latitude', '10')
      .field('longitude', '10')
      .field('capturedAt', new Date().toISOString())
      .field('reportedAreaM2', '100');

    expect(res.status).toBe(400);
  });

  it('flags an exact-hash duplicate on a second identical upload', async () => {
    const { accessToken } = await registerAndLogin();
    const dupBytes = uniqueImageBytes('dup');

    const first = await request(app)
      .post('/api/observations')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('ecosystemCode', 'salt_marsh')
      .field('latitude', '40.7')
      .field('longitude', '-74.0')
      .field('capturedAt', new Date().toISOString())
      .field('reportedAreaM2', '100')
      .attach('image', dupBytes, { filename: 'dup.jpg', contentType: 'image/jpeg' });
    expect(first.body.duplicateWarning).toBeNull();

    const second = await request(app)
      .post('/api/observations')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('ecosystemCode', 'salt_marsh')
      .field('latitude', '40.71')
      .field('longitude', '-74.01')
      .field('capturedAt', new Date().toISOString())
      .field('reportedAreaM2', '100')
      .attach('image', dupBytes, { filename: 'dup-again.jpg', contentType: 'image/jpeg' });

    expect(second.status).toBe(201);
    expect(second.body.duplicateWarning).not.toBeNull();
    expect(second.body.duplicateWarning.observationId).toBe(first.body.observationId);
  });

  it('prevents one field_operator from reading another operator\'s observation', async () => {
    const owner = await registerAndLogin();
    const intruder = await registerAndLogin();

    const created = await request(app)
      .post('/api/observations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .field('ecosystemCode', 'mangrove')
      .field('latitude', '1')
      .field('longitude', '1')
      .field('capturedAt', new Date().toISOString())
      .field('reportedAreaM2', '50')
      .attach('image', uniqueImageBytes('private'), { filename: 'private.jpg', contentType: 'image/jpeg' });

    const blocked = await request(app)
      .get(`/api/observations/${created.body.observationId}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);

    expect(blocked.status).toBe(403);
  });

  it('streams the uploaded evidence bytes back unchanged', async () => {
    const { accessToken } = await registerAndLogin();
    const payload = uniqueImageBytes('roundtrip');

    const created = await request(app)
      .post('/api/observations')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('ecosystemCode', 'mangrove')
      .field('latitude', '5')
      .field('longitude', '5')
      .field('capturedAt', new Date().toISOString())
      .field('reportedAreaM2', '75')
      .attach('image', payload, { filename: 'roundtrip.jpg', contentType: 'image/jpeg' });

    const raw = await request(app)
      .get(`/api/evidence/${created.body.evidenceFileId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(raw.status).toBe(200);
    expect(Buffer.compare(raw.body as Buffer, payload)).toBe(0);
  });

  it('lists seeded ecosystem types and carbon factors', async () => {
    const { accessToken } = await registerAndLogin();

    const ecosystems = await request(app)
      .get('/api/carbon/ecosystem-types')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(ecosystems.status).toBe(200);
    expect(ecosystems.body.ecosystemTypes).toHaveLength(3);

    const factors = await request(app).get('/api/carbon/factors').set('Authorization', `Bearer ${accessToken}`);
    expect(factors.status).toBe(200);
    expect(factors.body.carbonFactors.length).toBeGreaterThanOrEqual(3);
  });
});
