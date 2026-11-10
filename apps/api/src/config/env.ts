import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// or postgresql:// connection string'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:8081')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  JOBS_ENABLED: z.stringbool().default(true),
  APP_VERSION: z.string().default('0.0.0'),
  JWT_SECRET: z.string().min(32).default('dev-only-change-me-jwt-secret-32ch'),
  TOTP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'must be 32 bytes as 64 hex chars')
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  ADMIN_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(10 * 60),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(30 * 24 * 60 * 60),
  ADMIN_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(12 * 60 * 60),
  COOKIE_SECURE: z.stringbool().default(false),
  MAIL_HOST: z.string().default('127.0.0.1'),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default('PlayAround <noreply@playaround.local>'),
  MAIL_USER: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  MAIL_PASSWORD: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\s+/g, '') || undefined),
  GOOGLE_CLIENT_IDS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  APPLE_CLIENT_IDS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  STAFF_SEED_EMAIL: z.string().default('admin@playaround.local'),
  STAFF_SEED_PASSWORD: z.string().default('PlayAroundAdmin1'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  RATE_LIMIT_DISABLED: z.stringbool().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export function rateLimitsEnabled(env: Pick<Env, 'NODE_ENV' | 'RATE_LIMIT_DISABLED'>): boolean {
  if (env.RATE_LIMIT_DISABLED !== undefined) return !env.RATE_LIMIT_DISABLED;
  return env.NODE_ENV !== 'test';
}
