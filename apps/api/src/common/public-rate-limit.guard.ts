import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';

const WINDOW_MS = 60_000;

// Limits each client IP to PUBLIC_RATE_LIMIT_PER_MINUTE requests per route per
// minute. Counters live in Redis, so the limit holds across API instances.
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(PublicRateLimitGuard.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const window = Math.floor(Date.now() / WINDOW_MS);
    const key = `rate-limit:${req.method}:${req.route?.path ?? req.path}:${req.ip}:${window}`;

    let count: number;
    try {
      count = await this.redis.incr(key);
      if (count === 1) await this.redis.pexpire(key, WINDOW_MS);
    } catch (error) {
      // Fail open: a Redis outage shouldn't stop people from reaching the Agent.
      this.logger.warn({ err: error }, 'Rate limit check skipped: Redis unavailable');
      return true;
    }

    if (count > this.env.PUBLIC_RATE_LIMIT_PER_MINUTE) {
      throw new HttpException('Too many requests, try again in a minute', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
