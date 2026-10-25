import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [RealtimeModule],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
