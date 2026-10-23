import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ChatTokenService } from './chat-token.service.js';
import { type ChatRequest } from './chat-session.decorators.js';

@Injectable()
export class ChatTokenGuard implements CanActivate {
  constructor(private readonly chatTokens: ChatTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ChatRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    const claims =
      scheme === 'Bearer' && token ? await this.chatTokens.verify(token) : null;
    if (!claims) throw new UnauthorizedException();

    req.chat = claims;
    return true;
  }
}
