import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type Request } from 'express';
import { type ChatTokenClaims } from './chat-token.service.js';

export interface ChatRequest extends Request {
  chat?: ChatTokenClaims;
}

export const ChatSession = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    return context.switchToHttp().getRequest<ChatRequest>().chat;
  },
);
