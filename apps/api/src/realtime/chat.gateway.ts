import { type OnGatewayConnection, type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { ChatMessage } from '@realestate-system/shared';
import type { Namespace, Socket } from 'socket.io';
import { ChatTokenService } from '../chat/chat-token.service.js';

interface ChatSocketData {
  leadId: string;
}

// The Lead's side of Web Chat. Every connection for one Lead joins the room
// `lead:<id>`, so "send to Lead X" is an emit to that room.
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: Namespace;

  constructor(private readonly chatTokens: ChatTokenService) {}

  // Checked during the handshake, so a client only sees `connect` once it's in
  // its room, and a bad token gets `connect_error` instead of a silent socket.
  afterInit(server: Namespace) {
    server.use((socket, next) => {
      const token: unknown = socket.handshake.auth['token'];
      if (typeof token !== 'string') return next(new Error('Unauthorized'));
      void this.chatTokens.verify(token).then((claims) => {
        // A visitor token has no Lead yet, so there's nothing to listen to.
        if (!claims?.leadId) return next(new Error('Unauthorized'));
        (socket.data as ChatSocketData).leadId = claims.leadId;
        next();
      });
    });
  }

  async handleConnection(client: Socket) {
    await client.join(roomFor((client.data as ChatSocketData).leadId));
  }

  broadcast(leadId: string, message: ChatMessage): void {
    this.server.to(roomFor(leadId)).emit('message.created', message);
  }
}

function roomFor(leadId: string): string {
  return `lead:${leadId}`;
}
