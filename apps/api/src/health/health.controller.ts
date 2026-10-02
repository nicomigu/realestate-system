import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../auth/auth.decorators.js';
import { DatabaseHealthIndicator, RedisHealthIndicator } from './health.indicators.js';

@ApiTags('ops')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.database.check(), () => this.redis.check()]);
  }
}
