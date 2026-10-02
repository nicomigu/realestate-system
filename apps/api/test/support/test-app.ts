import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import type { App } from 'supertest/types.js';
import type { Db } from '../../prisma/db.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { CHANNEL_ADAPTERS } from '../../src/channels/channel-adapter.js';
import { CLOCK } from '../../src/clock/clock.js';
import { DB } from '../../src/database/database.module.js';
import { REDIS } from '../../src/redis/redis.module.js';
import { FakeClock } from './fake-clock.js';
import { RecordingChannelAdapter } from './recording-channel-adapter.js';

export interface TestApp {
  app: INestApplication<App>;
  http: App;
  /** For arranging state and checking what no API route exposes yet. */
  db: Db;
  clock: FakeClock;
  channels: RecordingChannelAdapter;
  /** Empties every table and the test Redis db, and rewinds the clock. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

export interface TestAppOptions {
  /** Env overrides applied while the app boots; `undefined` removes a variable. */
  env?: Record<string, string | undefined>;
  /** Extra controllers mounted for one test file, e.g. to probe guards. */
  controllers?: Type[];
}

// Boots the real AppModule against the test Postgres and Redis. Only the ports
// that reach outside the system (clock, outbound channels) are swapped.
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const clock = new FakeClock();
  const channels = new RecordingChannelAdapter();

  const app = await withEnv(options.env ?? {}, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: options.controllers ?? [],
    })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(CHANNEL_ADAPTERS)
      .useValue(channels.asAdapters())
      .compile();
    const nestApp = moduleRef.createNestApplication<INestApplication<App>>({ bufferLogs: true });
    setupApp(nestApp);
    await nestApp.init();
    return nestApp;
  });

  const db = app.get<Db>(DB);
  const redis = app.get<Redis>(REDIS);

  return {
    app,
    http: app.getHttpServer(),
    db,
    clock,
    channels,
    async reset() {
      await truncateAllTables(db);
      await redis.flushdb();
      clock.reset();
      channels.clear();
    },
    close: () => app.close(),
  };
}

async function truncateAllTables(db: Db): Promise<void> {
  const plan = db.raw.sql`
    DO $$
    DECLARE tables text;
    BEGIN
      SELECT string_agg(format('%I', tablename), ', ') INTO tables
      FROM pg_tables WHERE schemaname = 'public';
      IF tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$`
    .affectedCount()
    .build();
  await db.runtime().execute(plan);
}

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(Object.keys(overrides).map((k) => [k, process.env[k]]));
  applyEnv(overrides);
  try {
    return await fn();
  } finally {
    applyEnv(previous);
  }
}

function applyEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
