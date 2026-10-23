import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { ChatTokenModule } from './chat-token.module.js';
import { ChatTokenGuard } from './chat-token.guard.js';
import { PublicChatController } from './public-chat.controller.js';

@Module({
  imports: [ChatTokenModule, LeadsModule, MessagesModule],
  controllers: [PublicChatController],
  providers: [ChatTokenGuard],
})
export class ChatModule {}
