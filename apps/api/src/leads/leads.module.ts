import { Module } from '@nestjs/common';
import { ChatTokenModule } from '../chat/chat-token.module.js';
import { LeadIntakeService } from './lead-intake.service.js';
import { PublicLeadsController } from './public-leads.controller.js';

@Module({
  imports: [ChatTokenModule],
  controllers: [PublicLeadsController],
  providers: [LeadIntakeService],
  exports: [LeadIntakeService],
})
export class LeadsModule {}
