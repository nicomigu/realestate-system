import { z } from 'zod';

export const ENV = Symbol('ENV');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  // The web app's origin; browsers may call the API only from here (CORS).
  WEB_ORIGIN: z.url({ protocol: /^https?$/ }).transform((url) => new URL(url).origin),
  // Signs chat tokens. Separate from the Agent login secret, so neither can pass as the other.
  CHAT_TOKEN_SECRET: z.string().min(32, 'must be at least 32 characters'),
  // Signs dashboard login tokens for Agents and Admins.
  AUTH_TOKEN_SECRET: z.string().min(32, 'must be at least 32 characters'),
  // Submissions per IP per minute on public forms.
  PUBLIC_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
});

export type Env = z.infer<typeof EnvSchema>;

// Fails at boot, naming every bad variable, instead of at the first request that needs one.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
