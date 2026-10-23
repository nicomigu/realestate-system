import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { JwtService } from '@nestjs/jwt';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { createAgent, dashboardToken } from './support/fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('/chat socket', () => {
  let t: TestApp;
  let url: string;
  let agentToken: string;
  const sockets: Socket[] = [];

  const submitForm = async (email: string) =>
    (await request(t.http).post('/public/leads').send({ name: 'Maria', email }).expect(201)).body as {
      leadId: string;
      chatToken: string;
    };
  const reply = (leadId: string, body: string) =>
    request(t.http)
      .post(`/leads/${leadId}/messages`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body })
      .expect(201);

  // Resolves once the handshake succeeds, rejects when the server refuses it.
  function connect(token: string): Promise<Socket> {
    const socket = io(`${url}/chat`, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  function nextMessage(socket: Socket): Promise<unknown> {
    return new Promise((resolve) => socket.once('message.created', resolve));
  }

  beforeAll(async () => {
    t = await createTestApp();
    // Sockets need a real port, unlike Supertest.
    await t.app.listen(0);
    const { port } = (t.app.getHttpServer() as unknown as Server).address() as AddressInfo;
    url = `http://localhost:${port}`;
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    const agent = await createAgent(t.db);
    agentToken = dashboardToken(t.app, { id: agent.id, role: 'AGENT' });
  });

  afterEach(() => {
    // An open socket keeps Jest from exiting.
    for (const socket of sockets.splice(0)) socket.close();
  });

  it('delivers the Agent’s reply live', async () => {
    const { leadId, chatToken } = await submitForm('maria@example.com');
    const socket = await connect(chatToken);
    const received = nextMessage(socket);

    await reply(leadId, 'Hi Maria!');

    expect(await received).toMatchObject({ author: 'AGENT', body: 'Hi Maria!' });
  });

  it('delivers the Lead’s own message to their other tabs', async () => {
    const { chatToken } = await submitForm('maria@example.com');
    const otherTab = await connect(chatToken);
    const received = nextMessage(otherTab);

    await request(t.http)
      .post('/public/chat/messages')
      .set('Authorization', `Bearer ${chatToken}`)
      .send({ body: 'Sent from my phone' })
      .expect(201);

    expect(await received).toMatchObject({ author: 'LEAD', body: 'Sent from my phone' });
  });

  it('a token for another Lead doesn’t receive it', async () => {
    const maria = await submitForm('maria@example.com');
    const juan = await submitForm('juan@example.com');
    const juansSocket = await connect(juan.chatToken);
    const received: unknown[] = [];
    juansSocket.on('message.created', (message) => received.push(message));

    await reply(maria.leadId, 'Hi Maria!');
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received).toEqual([]);
  });

  describe('refuses the connection', () => {
    it('for a visitor token, which has no Lead to listen to', async () => {
      const res = await request(t.http).post('/public/chat/sessions').expect(201);

      await expect(connect(res.body.chatToken)).rejects.toThrow('Unauthorized');
    });

    it('for a forged token', async () => {
      const forged = new JwtService().sign(
        { leadId: 'someone-else', since: new Date().toISOString() },
        { secret: 'not-the-chat-token-secret-but-long-enough', audience: 'chat' },
      );

      await expect(connect(forged)).rejects.toThrow('Unauthorized');
    });

    it('without a token', async () => {
      const socket = io(`${url}/chat`, { transports: ['websocket'], reconnection: false });
      sockets.push(socket);

      await expect(
        new Promise<void>((resolve, reject) => {
          socket.on('connect', () => resolve());
          socket.on('connect_error', reject);
        }),
      ).rejects.toThrow('Unauthorized');
    });
  });
});
