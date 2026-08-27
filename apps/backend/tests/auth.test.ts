import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { db, closeDatabaseConnection } from '../src/db/client';

const app = createApp();

function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
}

describe('auth flow', () => {
  const testEmails: string[] = [];

  afterAll(async () => {
    if (testEmails.length > 0) {
      await db.deleteFrom('users').where('email', 'in', testEmails).execute();
    }
    await closeDatabaseConnection();
  });

  it('registers a new field_operator account', async () => {
    const email = uniqueEmail();
    testEmails.push(email);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-1', fullName: 'Test Operator' });

    expect(res.status).toBe(201);
    expect(res.body.user.email.toLowerCase()).toBe(email.toLowerCase());
    expect(res.body.user.role).toBe('field_operator');
    expect(res.body.tokens.accessToken).toBeTruthy();
    expect(res.body.tokens.refreshToken).toBeTruthy();
  });

  it('rejects duplicate registration with 409', async () => {
    const email = uniqueEmail();
    testEmails.push(email);

    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-1', fullName: 'Dup Test' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-1', fullName: 'Dup Test' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects registration with a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: 'short', fullName: 'Weak Password Test' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const email = uniqueEmail();
    testEmails.push(email);
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-1', fullName: 'Login Test' });

    const good = await request(app).post('/api/auth/login').send({ email, password: 'correct-horse-1' });
    expect(good.status).toBe(200);

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('round-trips a refresh token and rejects reuse of the rotated token', async () => {
    const email = uniqueEmail();
    testEmails.push(email);
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-1', fullName: 'Refresh Test' });
    const originalRefreshToken = registerRes.body.tokens.refreshToken;

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.tokens.refreshToken).not.toBe(originalRefreshToken);

    const reuseRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefreshToken });
    expect(reuseRes.status).toBe(401);
  });

  it('rejects /me without a token and accepts it with one', async () => {
    const email = uniqueEmail();
    testEmails.push(email);
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-1', fullName: 'Me Test' });

    const unauthed = await request(app).get('/api/auth/me');
    expect(unauthed.status).toBe(401);

    const authed = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registerRes.body.tokens.accessToken}`);
    expect(authed.status).toBe(200);
    expect(authed.body.user.email.toLowerCase()).toBe(email.toLowerCase());
  });

  it('logout revokes the refresh token', async () => {
    const email = uniqueEmail();
    testEmails.push(email);
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-1', fullName: 'Logout Test' });
    const refreshToken = registerRes.body.tokens.refreshToken;

    const logoutRes = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const reuseRes = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(reuseRes.status).toBe(401);
  });
});
