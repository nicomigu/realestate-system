import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { activityTypes, createAdmin, createAgent, findLead } from './support/fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('POST /public/leads', () => {
  let t: TestApp;
  let agentId: string;

  const submit = (body: object) => request(t.http).post('/public/leads').send(body);

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    await createAdmin(t.db);
    agentId = (await createAgent(t.db)).id;
  });

  it('creates a Website Lead assigned to the Agent', async () => {
    const res = await submit({ name: 'Maria Santos', email: 'maria@example.com' }).expect(201);

    expect(res.body).toEqual({ leadId: expect.any(String), chatToken: expect.any(String) });
    const lead = await findLead(t.db, res.body.leadId);
    expect(lead).toMatchObject({
      name: 'Maria Santos',
      email: 'maria@example.com',
      phone: null,
      source: 'WEBSITE',
      stage: 'NEW',
      assignedToId: agentId,
    });
    expect(await activityTypes(t.db, res.body.leadId)).toEqual(['lead.created']);
  });

  it.each([
    ['facebook', 'FACEBOOK'],
    ['FB', 'FACEBOOK'],
    ['zillow', 'ZILLOW'],
    ['google-ads', 'GOOGLE_ADS'],
    ['adwords', 'GOOGLE_ADS'],
    ['newsletter', 'WEBSITE'],
  ])('maps utm_source "%s" to the %s Lead Source', async (utmSource, source) => {
    const res = await submit({ name: 'Maria', email: 'maria@example.com', utmSource }).expect(201);

    expect(await findLead(t.db, res.body.leadId)).toMatchObject({ source });
  });

  it('stores contact details normalized', async () => {
    const res = await submit({
      name: '  Maria  ',
      email: ' Maria@Example.COM ',
      phone: '+63 917-123-4567',
    }).expect(201);

    expect(await findLead(t.db, res.body.leadId)).toMatchObject({
      name: 'Maria',
      email: 'maria@example.com',
      phone: '+639171234567',
    });
  });

  describe('when the person already has an open Lead', () => {
    it('matches by email regardless of case and keeps the original Lead Source', async () => {
      const first = await submit({ name: 'Maria', email: 'maria@example.com', utmSource: 'facebook' });

      const second = await submit({ name: 'Maria S.', email: 'MARIA@example.com', utmSource: 'zillow' })
        .expect(200);

      expect(second.body.leadId).toBe(first.body.leadId);
      expect(await findLead(t.db, first.body.leadId)).toMatchObject({ source: 'FACEBOOK' });
      expect(await activityTypes(t.db, first.body.leadId)).toEqual([
        'lead.created',
        'lead.duplicate_received',
      ]);
    });

    it('matches by phone regardless of formatting', async () => {
      const first = await submit({ name: 'Maria', phone: '+63 917 123 4567' });

      const second = await submit({ name: 'Maria', email: 'new@example.com', phone: '+63-917-123-4567' })
        .expect(200);

      expect(second.body.leadId).toBe(first.body.leadId);
    });

    it('matches by email before phone', async () => {
      const byEmail = await submit({ name: 'Maria', email: 'maria@example.com' });
      await submit({ name: 'Someone else', phone: '+639171234567' });

      const res = await submit({ name: 'Maria', email: 'maria@example.com', phone: '+639171234567' })
        .expect(200);

      expect(res.body.leadId).toBe(byEmail.body.leadId);
    });
  });

  it('creates a new Lead when the person’s only Lead is Closed', async () => {
    const first = await submit({ name: 'Maria', email: 'maria@example.com' });
    await t.db.orm.public.Lead.where({ id: first.body.leadId }).update({ stage: 'CLOSED_LOST' });

    const second = await submit({ name: 'Maria', email: 'maria@example.com' }).expect(201);

    expect(second.body.leadId).not.toBe(first.body.leadId);
  });

  it('returns a chat token for the Lead that only covers messages from now on', async () => {
    const res = await submit({ name: 'Maria', email: 'maria@example.com' }).expect(201);

    const claims = new JwtService().verify(res.body.chatToken, {
      secret: process.env['CHAT_TOKEN_SECRET'],
      audience: 'chat',
    });
    expect(claims).toMatchObject({ leadId: res.body.leadId, since: t.clock.now().toISOString() });
    expect(claims.exp - claims.iat).toBe(30 * 24 * 60 * 60);
  });

  describe('rejects invalid submissions', () => {
    it.each([
      ['no email or phone', { name: 'Maria' }, 'email'],
      ['a malformed email', { name: 'Maria', email: 'not-an-email' }, 'email'],
      ['a malformed phone', { name: 'Maria', phone: 'call me' }, 'phone'],
      ['no name', { email: 'maria@example.com' }, 'name'],
    ])('%s', async (_, body, field) => {
      const res = await submit(body).expect(400);

      expect(res.body.errors).toHaveProperty(field);
    });

    it('treats blank optional fields as missing', async () => {
      await submit({ name: 'Maria', email: 'maria@example.com', phone: '', utmSource: '' }).expect(201);
    });
  });

  it('fails loudly when there is no Agent to assign', async () => {
    await t.reset();

    await submit({ name: 'Maria', email: 'maria@example.com' }).expect(500);
  });

  it('allows the web app’s origin', async () => {
    const res = await request(t.http)
      .options('/public/leads')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
  });
});

describe('POST /public/leads rate limit', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ env: { PUBLIC_RATE_LIMIT_PER_MINUTE: '2' } });
    await t.reset();
    await createAgent(t.db);
  });
  afterAll(() => t.close());

  it('returns 429 after too many submissions from one client', async () => {
    const submit = (n: number) =>
      request(t.http).post('/public/leads').send({ name: 'Bot', email: `bot${n}@example.com` });

    await submit(1).expect(201);
    await submit(2).expect(201);
    await submit(3).expect(429);
  });
});
