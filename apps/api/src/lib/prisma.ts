import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

export type Database = PrismaClient;

/** Row-lock transactions (join/leave) wait in the pool while other requests hold FOR UPDATE. */
export const lockedTx = { maxWait: 30_000, timeout: 30_000 } as const;

/** Render's public hostname requires TLS even when `sslmode` is omitted from DATABASE_URL. */
export function poolSslFromDatabaseUrl(databaseUrl: string): PoolConfig['ssl'] {
  const url = new URL(databaseUrl);
  const sslMode = (url.searchParams.get('sslmode') ?? url.searchParams.get('ssl') ?? '').toLowerCase();
  if (sslMode === 'disable' || sslMode === 'false') return undefined;
  if (sslMode === 'verify-full' || sslMode === 'verify-ca') return { rejectUnauthorized: true };
  if (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'true' || sslMode === '1') {
    return { rejectUnauthorized: false };
  }
  if (url.hostname.endsWith('.render.com')) return { rejectUnauthorized: false };
  return undefined;
}

export function createPrismaClient(databaseUrl: string): Database {
  const ssl = poolSslFromDatabaseUrl(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 16,
    connectionTimeoutMillis: 10_000,
    ...(ssl ? { ssl } : {}),
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export async function checkDatabase(
  db: Database,
  timeoutMs = 8_000,
  onError?: (err: unknown) => void,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const ping = db.$queryRaw`SELECT 1`.then(
    () => true,
    (err) => {
      onError?.(err);
      return false;
    },
  );
  try {
    return await Promise.race([ping, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
