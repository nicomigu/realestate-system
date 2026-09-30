import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('GET /health', () => {
  describe('when Postgres and Redis are up', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp();
    });
    afterAll(() => t.close());

    it('reports both dependencies up', async () => {
      const res = await request(t.http).get('/health').expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        info: { database: { status: 'up' }, redis: { status: 'up' } },
      });
    });

    it('gives each request an id and returns it', async () => {
      const res = await request(t.http).get('/health').expect(200);

      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('keeps the caller’s request id', async () => {
      const res = await request(t.http)
        .get('/health')
        .set('x-request-id', 'trace-123')
        .expect(200);

      expect(res.headers['x-request-id']).toBe('trace-123');
    });

    it('replaces a malformed request id', async () => {
      const res = await request(t.http)
        .get('/health')
        .set('x-request-id', 'not a valid id!')
        .expect(200);

      expect(res.headers['x-request-id']).not.toBe('not a valid id!');
    });
  });

  describe('when Redis is unreachable', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp({ env: { REDIS_URL: 'redis://localhost:6390/0' } });
    });
    afterAll(() => t.close());

    it('returns 503 and names Redis as down', async () => {
      const res = await request(t.http).get('/health').expect(503);

      expect(res.body).toMatchObject({
        status: 'error',
        info: { database: { status: 'up' } },
        error: { redis: { status: 'down' } },
      });
    });
  });

  describe('when Postgres is unreachable', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp({
        env: { DATABASE_URL: 'postgresql://realestate:realestate@localhost:5499/realestate' },
      });
    });
    afterAll(() => t.close());

    it('returns 503 and names the database as down', async () => {
      const res = await request(t.http).get('/health').expect(503);

      expect(res.body).toMatchObject({
        status: 'error',
        info: { redis: { status: 'up' } },
        error: { database: { status: 'down' } },
      });
    });
  });
});
