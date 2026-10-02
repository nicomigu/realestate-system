import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthTokenService } from './auth-token.service.js';
import { type AuthenticatedRequest, IS_PUBLIC } from './auth.decorators.js';

// Registered globally: every route requires a valid dashboard token unless it's
// marked @Public(). A route someone forgets to protect fails closed.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AuthTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    const user = scheme === 'Bearer' && token ? await this.tokens.verify(token) : null;
    if (!user) throw new UnauthorizedException();

    req.user = user;
    return true;
  }
}
