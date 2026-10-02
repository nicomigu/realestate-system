import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthUser, Login, LoginResponse } from '@realestate-system/shared';
import type { Db } from '../../prisma/db.js';
import { DB } from '../database/database.module.js';
import { AuthTokenService } from './auth-token.service.js';
import { hashPassword, verifyPassword } from './password.js';

@Injectable()
export class AuthService {
  // Checked when the email is unknown, so a wrong email takes as long as a
  // wrong password and response times don't reveal which accounts exist.
  private readonly decoyHash = hashPassword('decoy-password-never-matches');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tokens: AuthTokenService,
  ) {}

  async login({ email, password }: Login): Promise<LoginResponse> {
    const user = await this.db.orm.public.User.where({ email }).first();
    const valid = await verifyPassword(password, user?.passwordHash ?? (await this.decoyHash));
    if (!user || !valid) throw new UnauthorizedException('Wrong email or password');

    const authUser = toAuthUser(user);
    return { accessToken: this.tokens.issue(authUser), user: authUser };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.db.orm.public.User.where({ id: userId }).first();
    // A valid token for a user who has since been deleted.
    if (!user) throw new UnauthorizedException();
    return toAuthUser(user);
  }
}

function toAuthUser(user: AuthUser): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
