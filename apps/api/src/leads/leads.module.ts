import { Module } from '@nestjs/common';
import { ChatTokenModule } from '../chat/chat-token.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { LeadIntakeService } from './lead-intake.service.js';
import { LeadsController } from './leads.controller.js';
import { PublicLeadsController } from './public-leads.controller.js';

@Module({
  imports: [ChatTokenModule, MessagesModule],
  controllers: [PublicLeadsController, LeadsController],
  providers: [LeadIntakeService],
  exports: [LeadIntakeService],
})
export class LeadsModule {}
