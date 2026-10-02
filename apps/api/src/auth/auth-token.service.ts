import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@realestate-system/shared';
import type { RequestUser } from './auth.decorators.js';

// Chat tokens use the audience "chat" and a different secret, so neither kind
// of token can ever pass as the other.
export const AUTH_TOKEN_AUDIENCE = 'dashboard';
const AUTH_TOKEN_LIFETIME = '12h';

interface AuthTokenClaims {
  sub: string;
  role: Role;
}

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwt: JwtService) {}

  issue(user: RequestUser): string {
    const claims: AuthTokenClaims = { sub: user.id, role: user.role };
    return this.jwt.sign(claims, { audience: AUTH_TOKEN_AUDIENCE, expiresIn: AUTH_TOKEN_LIFETIME });
  }

  /** The token's user, or null when it's missing, forged, expired or meant for something else. */
  async verify(token: string): Promise<RequestUser | null> {
    try {
      const claims = await this.jwt.verifyAsync<AuthTokenClaims>(token, {
        audience: AUTH_TOKEN_AUDIENCE,
      });
      return { id: claims.sub, role: claims.role };
    } catch {
      return null;
    }
  }
}
