import { Module } from '@nestjs/common';
import { ChatTokenModule } from '../chat/chat-token.module.js';
import { ChatGateway } from './chat.gateway.js';

// Its own module so MessagesModule can push messages without importing
// ChatModule, which itself depends on MessagesModule.
@Module({
  imports: [ChatTokenModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class RealtimeModule {}
