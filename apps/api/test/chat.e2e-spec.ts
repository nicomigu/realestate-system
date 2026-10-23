import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { activityTypes, createAgent, dashboardToken, findLead } from './support/fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Public Web Chat', () => {
  let t: TestApp;
  let agentId: string;

  const startSession = async () =>
    (await request(t.http).post('/public/chat/sessions').expect(201)).body.chatToken as string;
  const send = (token: string, body: string) =>
    request(t.http).post('/public/chat/messages').set('Authorization', `Bearer ${token}`).send({ body });
  const history = (token: string) =>
    request(t.http).get('/public/chat/messages').set('Authorization', `Bearer ${token}`);
  const submitForm = async () =>
    (await request(t.http).post('/public/leads').send({ name: 'Maria', email: 'maria@example.com' })).body as {
      leadId: string;
      chatToken: string;
    };

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    agentId = (await createAgent(t.db)).id;
  });

  it('opening a session creates no Lead', async () => {
    await startSession();

    expect(await t.db.orm.public.Lead.all()).toEqual([]);
  });

  it('the first message creates a Website Lead assigned to the Agent and returns a token for it', async () => {
    const res = await send(await startSession(), 'Hi, do you have condos in Makati?').expect(201);

    expect(res.body).toEqual({
      message: {
        id: expect.any(String),
        author: 'LEAD',
        body: 'Hi, do you have condos in Makati?',
        createdAt: t.clock.now().toISOString(),
      },
      leadId: expect.any(String),
      chatToken: expect.any(String),
    });
    expect(await findLead(t.db, res.body.leadId)).toMatchObject({
      name: null,
      email: null,
      phone: null,
      source: 'WEBSITE',
      stage: 'NEW',
      assignedToId: agentId,
    });
    // Both happen in the same instant, so only membership is certain.
    expect((await activityTypes(t.db, res.body.leadId)).sort()).toEqual(['lead.created', 'message.received']);
  });

  it('the new token keeps the visitor token’s since and belongs to the Lead', async () => {
    const visitorToken = await startSession();
    t.clock.advance(5_000);

    const res = await send(visitorToken, 'Hello').expect(201);

    const claims = new JwtService().verify(res.body.chatToken, {
      secret: process.env['CHAT_TOKEN_SECRET'],
      audience: 'chat',
    });
    expect(claims).toMatchObject({
      leadId: res.body.leadId,
      since: new Date(t.clock.now().getTime() - 5_000).toISOString(),
    });
  });

  it('later messages with the new token go to the same Lead', async () => {
    const first = await send(await startSession(), 'Hello').expect(201);

    const second = await send(first.body.chatToken, 'Are you there?').expect(201);

    expect(second.body.leadId).toBe(first.body.leadId);
    expect(second.body).not.toHaveProperty('chatToken');
    expect(await t.db.orm.public.Lead.all()).toHaveLength(1);
  });

  it('the visitor sees their own first message', async () => {
    const first = await send(await startSession(), 'Hello').expect(201);

    const res = await history(first.body.chatToken).expect(200);

    expect(res.body).toEqual([first.body.message]);
  });

  it('a visitor token reads no history', async () => {
    const res = await history(await startSession()).expect(200);

    expect(res.body).toEqual([]);
  });

  it('a token’s since hides earlier messages', async () => {
    const firstVisit = await submitForm();
    await send(firstVisit.chatToken, 'My budget is 8M').expect(201);
    t.clock.advance(60_000);

    // Anyone can submit the form with Maria's email, so the new token can't read what she said before.
    const secondVisit = await submitForm();

    expect(secondVisit.leadId).toBe(firstVisit.leadId);
    expect((await history(secondVisit.chatToken).expect(200)).body).toEqual([]);
    expect((await history(firstVisit.chatToken).expect(200)).body).toHaveLength(1);
  });

  it('the form’s chat token can send to that Lead', async () => {
    const form = await submitForm();

    const res = await send(form.chatToken, 'I submitted the form').expect(201);

    expect(res.body.leadId).toBe(form.leadId);
    expect(res.body).not.toHaveProperty('chatToken');
  });

  describe('rejects a missing, forged or dashboard token', () => {
    const forged = () =>
      new JwtService().sign(
        { since: new Date().toISOString() },
        { secret: 'not-the-chat-token-secret-but-long-enough', audience: 'chat' },
      );
    const dashboard = () => dashboardToken(t.app, { id: agentId, role: 'AGENT' });

    it('on sending', async () => {
      await request(t.http).post('/public/chat/messages').send({ body: 'Hi' }).expect(401);
      await send(forged(), 'Hi').expect(401);
      await send(dashboard(), 'Hi').expect(401);
    });

    it('on reading', async () => {
      await request(t.http).get('/public/chat/messages').expect(401);
      await history(forged()).expect(401);
      await history(dashboard()).expect(401);
    });
  });

  it.each([
    ['an empty message', '   '],
    ['a message over 2000 characters', 'x'.repeat(2001)],
  ])('rejects %s', async (_, body) => {
    const res = await send(await startSession(), body).expect(400);

    expect(res.body.errors).toHaveProperty('body');
    expect(await t.db.orm.public.Lead.all()).toEqual([]);
  });
});
