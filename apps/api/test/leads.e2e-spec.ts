import request from 'supertest';
import { MessagesService } from '../src/messages/messages.service.js';
import { activityTypes, createAgent, dashboardToken, findLead } from './support/fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Dashboard Lead routes', () => {
  let t: TestApp;
  let agentId: string;
  let token: string;

  const submitForm = async (email = 'maria@example.com') =>
    (await request(t.http).post('/public/leads').send({ name: 'Maria', email }).expect(201)).body as {
      leadId: string;
      chatToken: string;
    };
  const reply = (leadId: string, body: string) =>
    request(t.http).post(`/leads/${leadId}/messages`).set('Authorization', `Bearer ${token}`).send({ body });
  const detail = (leadId: string) => request(t.http).get(`/leads/${leadId}`).set('Authorization', `Bearer ${token}`);
  const iso = (value: string | null | undefined) => (value ? new Date(value).toISOString() : value);

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    agentId = (await createAgent(t.db)).id;
    token = dashboardToken(t.app, { id: agentId, role: 'AGENT' });
  });

  describe('POST /leads/:id/messages', () => {
    it('the Agent’s first reply sets firstResponseAt and moves New → Contacted', async () => {
      const { leadId } = await submitForm();
      t.clock.advance(90_000);

      const res = await reply(leadId, 'Hi Maria!').expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        author: 'AGENT',
        body: 'Hi Maria!',
        createdAt: t.clock.now().toISOString(),
      });
      const lead = await findLead(t.db, leadId);
      expect(lead?.stage).toBe('CONTACTED');
      expect(iso(lead?.firstResponseAt)).toBe(t.clock.now().toISOString());
    });

    it('records message.sent and lead.stage_changed', async () => {
      const { leadId } = await submitForm();
      t.clock.advance(1_000);

      await reply(leadId, 'Hi Maria!').expect(201);

      const [first, ...rest] = await activityTypes(t.db, leadId);
      expect(first).toBe('lead.created');
      expect(rest.sort()).toEqual(['lead.stage_changed', 'message.sent']);
      const stageChange = await t.db.orm.public.ActivityEvent.where({ leadId, type: 'lead.stage_changed' }).first();
      expect(stageChange?.payload).toEqual({ from: 'NEW', to: 'CONTACTED', by: 'automation' });
    });

    it('a second reply doesn’t change firstResponseAt', async () => {
      const { leadId } = await submitForm();
      await reply(leadId, 'Hi Maria!').expect(201);
      const firstResponseAt = iso((await findLead(t.db, leadId))?.firstResponseAt);
      t.clock.advance(60_000);

      await reply(leadId, 'Are you free tomorrow?').expect(201);

      expect(iso((await findLead(t.db, leadId))?.firstResponseAt)).toBe(firstResponseAt);
    });

    it('a System message is not a First Response', async () => {
      const { leadId } = await submitForm();

      await t.app.get(MessagesService).sendFromSystem(leadId, 'Thanks for reaching out!');

      expect(await findLead(t.db, leadId)).toMatchObject({ stage: 'NEW', firstResponseAt: null });
    });

    it('doesn’t move a Lead that isn’t New', async () => {
      const { leadId } = await submitForm();
      await t.db.orm.public.Lead.where({ id: leadId }).update({ stage: 'QUALIFIED' });

      await reply(leadId, 'Hi Maria!').expect(201);

      const lead = await findLead(t.db, leadId);
      expect(lead?.stage).toBe('QUALIFIED');
      expect(lead?.firstResponseAt).not.toBeNull();
      expect(await activityTypes(t.db, leadId)).not.toContain('lead.stage_changed');
    });

    it('rejects an empty reply', async () => {
      const { leadId } = await submitForm();

      await reply(leadId, '  ').expect(400);
    });
  });

  describe('GET /leads/:id', () => {
    it('returns the profile, every message and the timeline, oldest first', async () => {
      const { leadId, chatToken } = await submitForm();
      t.clock.advance(1_000);
      await request(t.http)
        .post('/public/chat/messages')
        .set('Authorization', `Bearer ${chatToken}`)
        .send({ body: 'I want a condo' })
        .expect(201);
      t.clock.advance(1_000);
      await reply(leadId, 'Happy to help!').expect(201);

      const res = await detail(leadId).expect(200);

      expect(res.body.lead).toMatchObject({ id: leadId, name: 'Maria', email: 'maria@example.com', stage: 'CONTACTED' });
      expect(res.body.messages.map((m: { author: string; body: string }) => [m.author, m.body])).toEqual([
        ['LEAD', 'I want a condo'],
        ['AGENT', 'Happy to help!'],
      ]);
      const types = res.body.activity.map((e: { type: string }) => e.type);
      expect(types.slice(0, 2)).toEqual(['lead.created', 'message.received']);
      expect(types.slice(2).sort()).toEqual(['lead.stage_changed', 'message.sent']);
    });

    it('shows the Agent every message, even ones the Lead’s newest chat token hides', async () => {
      const { leadId, chatToken } = await submitForm();
      await request(t.http)
        .post('/public/chat/messages')
        .set('Authorization', `Bearer ${chatToken}`)
        .send({ body: 'Before' })
        .expect(201);
      t.clock.advance(60_000);
      // The same person again: a new token whose since hides "Before".
      await request(t.http).post('/public/leads').send({ name: 'Maria', email: 'maria@example.com' }).expect(200);

      const res = await detail(leadId).expect(200);

      expect(res.body.messages).toHaveLength(1);
    });
  });

  describe('GET /leads', () => {
    it('lists the newest Leads first', async () => {
      await submitForm('first@example.com');
      t.clock.advance(1_000);
      await submitForm('second@example.com');

      const res = await request(t.http).get('/leads').set('Authorization', `Bearer ${token}`).expect(200);

      expect(res.body.map((l: { email: string }) => l.email)).toEqual(['second@example.com', 'first@example.com']);
    });
  });

  describe('access', () => {
    it('unknown Lead → 404', async () => {
      await detail('no-such-lead').expect(404);
      await reply('no-such-lead', 'Hello?').expect(404);
    });

    it('no token or a chat token → 401', async () => {
      const { leadId, chatToken } = await submitForm();

      await request(t.http).get(`/leads/${leadId}`).expect(401);
      await request(t.http).get(`/leads/${leadId}`).set('Authorization', `Bearer ${chatToken}`).expect(401);
      await request(t.http)
        .post(`/leads/${leadId}/messages`)
        .set('Authorization', `Bearer ${chatToken}`)
        .send({ body: 'I am the Agent now' })
        .expect(401);
    });
  });
});
