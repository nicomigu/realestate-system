import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import type { Db } from '../../prisma/db.js';
import { DB } from '../database/database.module.js';
import { REDIS } from '../redis/redis.module.js';
import { withTimeout } from './with-timeout.js';

const CHECK_TIMEOUT_MS = 1000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(key = 'database') {
    const indicator = this.health.check(key);
    try {
      const plan = this.db.raw.sql`SELECT 1`.affectedCount().build();
      await withTimeout(this.db.runtime().execute(plan), CHECK_TIMEOUT_MS);
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: errorMessage(error) });
    }
  }
}

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(key = 'redis') {
    const indicator = this.health.check(key);
    try {
      await withTimeout(this.redis.ping(), CHECK_TIMEOUT_MS);
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: errorMessage(error) });
    }
  }
}
