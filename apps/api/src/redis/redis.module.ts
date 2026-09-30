import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      // Fail commands fast when Redis is down instead of queueing them forever.
      useFactory: (env: Env) => new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    // QUIT waits for a reply, so it would hang on a connection that never came up.
    if (this.redis.status === 'ready') await this.redis.quit();
    else this.redis.disconnect();
  }
}
