import { Global, Injectable, Logger, Module } from '@nestjs/common';
import {
  CHANNEL_ADAPTERS,
  type ChannelAdapter,
  type ChannelAdapters,
  type OutboundMessage,
} from './channel-adapter.js';

// Stand-in until each channel gets its real adapter (web socket push, email, SMS simulator).
@Injectable()
class LoggingChannelAdapter implements ChannelAdapter {
  private readonly logger = new Logger('Channels');

  async send(message: OutboundMessage): Promise<void> {
    this.logger.log({ message }, `No adapter for ${message.channel} yet; message logged`);
  }
}

@Global()
@Module({
  providers: [
    LoggingChannelAdapter,
    {
      provide: CHANNEL_ADAPTERS,
      inject: [LoggingChannelAdapter],
      useFactory: (logging: LoggingChannelAdapter): ChannelAdapters => ({
        WEB: logging,
        EMAIL: logging,
        SMS: logging,
      }),
    },
  ],
  exports: [CHANNEL_ADAPTERS],
})
export class ChannelsModule {}
