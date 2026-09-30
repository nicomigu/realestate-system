import type {
  Channel,
  ChannelAdapter,
  ChannelAdapters,
  OutboundMessage,
} from '../../src/channels/channel-adapter.js';

// Stands in for every channel and remembers what was sent, so tests assert on
// what a Lead would actually receive.
export class RecordingChannelAdapter implements ChannelAdapter {
  readonly sent: OutboundMessage[] = [];

  async send(message: OutboundMessage): Promise<void> {
    this.sent.push(message);
  }

  sentTo(to: string, channel?: Channel): OutboundMessage[] {
    return this.sent.filter((m) => m.to === to && (!channel || m.channel === channel));
  }

  clear(): void {
    this.sent.length = 0;
  }

  asAdapters(): ChannelAdapters {
    return { WEB: this, EMAIL: this, SMS: this };
  }
}
