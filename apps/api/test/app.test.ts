import { ApiErrorBody, HealthResponse, ReadinessResponse } from '@playaround/contracts';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const logger = pino({ level: 'silent' });

function makeApp(databaseUp = true) {
  return createApp({
    env: { CORS_ORIGINS: ['http://localhost:3000'], APP_VERSION: '9.9.9' },
    logger,
    checkDatabase: async () => databaseUp,
  });
}

describe('health', () => {
  it('reports liveness', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/health').expect(200);
    const body = HealthResponse.parse(res.body);
    expect(body.data.version).toBe('9.9.9');
    await request(app).get('/health').expect(200);
  });

  it('reports ready when the database is reachable', async () => {
    const res = await request(makeApp(true)).get('/api/v1/health/ready').expect(200);
    expect(ReadinessResponse.parse(res.body).data.checks.database).toBe('up');
  });

  it('reports not ready with 503 when the database is down', async () => {
    const res = await request(makeApp(false)).get('/api/v1/health/ready').expect(503);
    expect(ReadinessResponse.parse(res.body).data.status).toBe('not_ready');
  });
});

describe('error envelope', () => {
  it('returns NOT_FOUND for unknown routes', async () => {
    const res = await request(makeApp()).get('/api/v1/nope').expect(404);
    expect(ApiErrorBody.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('hints /api/v1 when the version prefix is missing', async () => {
    const res = await request(makeApp()).get('/auth/login').expect(404);
    expect(res.body.error.message).toContain('/api/v1/auth/login');
  });

  it('returns VALIDATION_ERROR for malformed JSON', async () => {
    const res = await request(makeApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(ApiErrorBody.parse(res.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('echoes the request id', async () => {
    const res = await request(makeApp())
      .get('/api/v1/nope')
      .set('X-Request-Id', 'req-123')
      .expect(404);
    expect(res.headers['x-request-id']).toBe('req-123');
    expect(res.body.error.requestId).toBe('req-123');
  });
});

describe('openapi', () => {
  it('serves the generated document', async () => {
    const res = await request(makeApp()).get('/docs/openapi.json').expect(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths['/health']).toBeTruthy();
    expect(res.body.paths['/auth/login']).toBeTruthy();
    expect(res.body.paths['/admin/auth/login']).toBeTruthy();
  });
});
