import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { closeDatabaseConnection, db } from '../src/db/client';

const app = createApp();
const testEmails: string[] = [];

describe('GET /api/analytics/dashboard', () => {
  afterAll(async () => {
    if (testEmails.length > 0) {
      await db.deleteFrom('users').where('email', 'in', testEmails).execute();
    }
    await closeDatabaseConnection();
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns a well-formed aggregate summary', async () => {
    const email = `test-analytics-${Date.now()}@example.test`;
    testEmails.push(email);
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-1', fullName: 'Analytics Tester' });

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${registerRes.body.tokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalObservations).toBe('number');
    expect(typeof res.body.verifiedMrvRecords).toBe('number');
    expect(typeof res.body.estimatedCarbonTotal).toBe('number');
    expect(Array.isArray(res.body.ecosystemDistribution)).toBe(true);
    expect(Array.isArray(res.body.aiConfidenceDistribution)).toBe(true);
    expect(Array.isArray(res.body.recentMrvRecords)).toBe(true);
    expect(Array.isArray(res.body.recentBlockchainTransactions)).toBe(true);
  });
});
