import { execSync } from 'node:child_process';
import pg from 'pg';

// Integration tests use their own Postgres database and Redis db index, so a
// test run never wipes local dev data. CI points these at its service containers.
const TEST_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL:
    process.env['TEST_DATABASE_URL'] ??
    'postgresql://realestate:realestate@localhost:5432/realestate_test',
  REDIS_URL: process.env['TEST_REDIS_URL'] ?? 'redis://localhost:6379/1',
  WEB_ORIGIN: 'http://localhost:3001',
  CHAT_TOKEN_SECRET: 'test-chat-token-secret-at-least-32-characters',
  // High enough that ordinary tests never trip it; the rate-limit test lowers it.
  PUBLIC_RATE_LIMIT_PER_MINUTE: '1000',
};

// Runs once per test run, before any test file. Jest doesn't apply
// moduleNameMapper here, so this file keeps no relative imports.
export default async function globalSetup(): Promise<void> {
  // Overwrites rather than defaults, so a DATABASE_URL exported in the
  // developer's shell can't point tests at dev data. Test files inherit these.
  Object.assign(process.env, TEST_ENV);

  await createDatabaseIfMissing(TEST_ENV.DATABASE_URL);
  execSync(`pnpm exec prisma db migrate --db "${TEST_ENV.DATABASE_URL}" --yes --quiet`, {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

async function createDatabaseIfMissing(url: string): Promise<void> {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';

  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }
}
