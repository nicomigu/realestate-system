import { z } from 'zod';

export const SendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Enter a message')
    .max(2000, 'Message is too long'),
});

export type SendMessage = z.infer<typeof SendMessageSchema>;

export type MessageAuthor = 'LEAD' | 'AI' | 'AGENT' | 'SYSTEM';

/** A message in the chat */
export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  body: string;
  createdAt: string;
}

export interface ChatSessionResponse {
  chatToken: string;
}

/**  `chatToken` is only present when this message created the Lead */
export interface SendMessageResponse {
  message: ChatMessage;
  leadId: string;
  chatToken?: string;
}
