import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ChannelsModule } from './channels/channels.module.js';
import { ClockModule } from './clock/clock.module.js';
import { ConfigModule } from './config/config.module.js';
import { ENV, type Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { loggerOptions } from './logger.options.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [ENV], useFactory: (env: Env) => loggerOptions(env) }),
    ClockModule,
    DatabaseModule,
    RedisModule,
    ChannelsModule,
    HealthModule,
  ],
})
export class AppModule {}
