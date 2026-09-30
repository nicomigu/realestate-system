// Outbound only: Web Chat is the one two-way channel, and inbound Web Chat
// messages arrive through the chat API, not an adapter (ADR 0002).
export type Channel = 'WEB' | 'EMAIL' | 'SMS';

export interface OutboundAttachment {
  filename: string;
  contentType: string;
  content: string;
}

export interface OutboundMessage {
  leadId: string;
  channel: Channel;
  to: string;
  subject?: string;
  body: string;
  attachments?: OutboundAttachment[];
}

export interface ChannelAdapter {
  send(message: OutboundMessage): Promise<void>;
}

export type ChannelAdapters = Record<Channel, ChannelAdapter>;

export const CHANNEL_ADAPTERS = Symbol('CHANNEL_ADAPTERS');
