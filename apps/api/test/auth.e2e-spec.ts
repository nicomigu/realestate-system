import { Controller, Get } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Roles } from '../src/auth/auth.decorators.js';
import { createAdmin, createAgent } from './support/fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

// Routes that exist only in this test file, to check the role guard on its own.
@Controller('test-only')
class RoleProbeController {
  @Get('anyone-signed-in')
  anyone() {
    return { ok: true };
  }

  @Roles('ADMIN')
  @Get('admins-only')
  admins() {
    return { ok: true };
  }

  @Roles('AGENT', 'ADMIN')
  @Get('agents-and-admins')
  agentsAndAdmins() {
    return { ok: true };
  }
}

const PASSWORD = 'correct horse battery staple';

describe('Dashboard auth', () => {
  let t: TestApp;
  let agentId: string;

  const login = (email: string, password: string) =>
    request(t.http).post('/auth/login').send({ email, password });

  const tokenFor = async (email: string) => (await login(email, PASSWORD).expect(200)).body.accessToken as string;

  beforeAll(async () => {
    t = await createTestApp({ controllers: [RoleProbeController] });
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    agentId = (await createAgent(t.db, { email: 'agent@example.com', password: PASSWORD })).id;
    await createAdmin(t.db, { email: 'admin@example.com', password: PASSWORD });
  });

  describe('POST /auth/login', () => {
    it('returns a dashboard token and the user for the right password', async () => {
      const res = await login('agent@example.com', PASSWORD).expect(200);

      expect(res.body.user).toEqual({
        id: agentId,
        email: 'agent@example.com',
        name: 'Nico Agent',
        role: 'AGENT',
      });
      const claims = new JwtService().verify(res.body.accessToken, {
        secret: process.env['AUTH_TOKEN_SECRET'],
        audience: 'dashboard',
      });
      expect(claims).toMatchObject({ sub: agentId, role: 'AGENT' });
    });

    it('accepts the email in any case', async () => {
      await login('  Agent@Example.COM ', PASSWORD).expect(200);
    });

    it('rejects a wrong password and an unknown email the same way', async () => {
      const wrongPassword = await login('agent@example.com', 'wrong').expect(401);
      const unknownEmail = await login('nobody@example.com', PASSWORD).expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it('rejects a malformed request', async () => {
      await request(t.http).post('/auth/login').send({ email: 'agent@example.com' }).expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the signed-in user', async () => {
      const token = await tokenFor('agent@example.com');

      const res = await request(t.http).get('/auth/me').auth(token, { type: 'bearer' }).expect(200);

      expect(res.body).toMatchObject({ id: agentId, role: 'AGENT' });
    });

    it('requires a token', async () => {
      await request(t.http).get('/auth/me').expect(401);
    });

    it('rejects a forged or malformed token', async () => {
      const forged = new JwtService().sign(
        { sub: agentId, role: 'ADMIN' },
        { secret: 'not-the-real-secret-but-32-characters-long', audience: 'dashboard' },
      );

      await request(t.http).get('/auth/me').auth(forged, { type: 'bearer' }).expect(401);
      await request(t.http).get('/auth/me').auth('not-a-jwt', { type: 'bearer' }).expect(401);
    });

    it('rejects a chat token', async () => {
      const lead = await request(t.http)
        .post('/public/leads')
        .send({ name: 'Maria', email: 'maria@example.com' })
        .expect(201);

      await request(t.http).get('/auth/me').auth(lead.body.chatToken, { type: 'bearer' }).expect(401);
    });

    it('rejects the token of a user who no longer exists', async () => {
      const token = await tokenFor('agent@example.com');
      await t.reset();

      await request(t.http).get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
    });
  });

  describe('role guard', () => {
    it('lets any signed-in user through when no role is required', async () => {
      const token = await tokenFor('agent@example.com');

      await request(t.http).get('/test-only/anyone-signed-in').auth(token, { type: 'bearer' }).expect(200);
    });

    it('keeps Agents out of Admin-only routes', async () => {
      const token = await tokenFor('agent@example.com');

      await request(t.http).get('/test-only/admins-only').auth(token, { type: 'bearer' }).expect(403);
    });

    it('lets Admins into Admin-only routes', async () => {
      const token = await tokenFor('admin@example.com');

      await request(t.http).get('/test-only/admins-only').auth(token, { type: 'bearer' }).expect(200);
    });

    it('allows any of several roles', async () => {
      const agent = await tokenFor('agent@example.com');
      const admin = await tokenFor('admin@example.com');

      await request(t.http).get('/test-only/agents-and-admins').auth(agent, { type: 'bearer' }).expect(200);
      await request(t.http).get('/test-only/agents-and-admins').auth(admin, { type: 'bearer' }).expect(200);
    });

    it('still requires sign-in before checking the role', async () => {
      await request(t.http).get('/test-only/admins-only').expect(401);
    });
  });

  it('leaves public routes open', async () => {
    await request(t.http).get('/health').expect(200);
  });
});

describe('POST /auth/login rate limit', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ env: { PUBLIC_RATE_LIMIT_PER_MINUTE: '2' } });
    await t.reset();
  });
  afterAll(() => t.close());

  it('returns 429 after too many attempts from one client', async () => {
    const attempt = () =>
      request(t.http).post('/auth/login').send({ email: 'agent@example.com', password: 'guess' });

    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(429);
  });
});
