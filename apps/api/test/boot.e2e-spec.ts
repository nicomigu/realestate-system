import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Booting the API', () => {
  it('refuses to start without a required variable, naming it', async () => {
    await expect(createTestApp({ env: { REDIS_URL: undefined } })).rejects.toThrow(/REDIS_URL/);
  });

  it('refuses to start with a malformed variable, naming it', async () => {
    await expect(
      createTestApp({ env: { DATABASE_URL: 'mysql://localhost/realestate' } }),
    ).rejects.toThrow(/DATABASE_URL/);
  });

  describe('when configured correctly', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp();
    });
    afterAll(() => t.close());

    it('serves the API docs', async () => {
      const res = await request(t.http).get('/docs-json').expect(200);

      expect(res.body.info.title).toBe('realestate-system API');
      expect(Object.keys(res.body.paths)).toContain('/health');
    });

    it('resets to an empty database', async () => {
      await expect(t.reset()).resolves.toBeUndefined();
    });
  });
});
