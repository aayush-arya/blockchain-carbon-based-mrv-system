import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /api/system/health', () => {
  it('reports API status and a per-component breakdown', async () => {
    const app = createApp();
    const res = await request(app).get('/api/system/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body.components.api.status).toBe('ok');
    expect(res.body.components).toHaveProperty('database');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('unmatched routes', () => {
  it('returns a structured 404', async () => {
    const app = createApp();
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.requestId).toBeTruthy();
  });
});
