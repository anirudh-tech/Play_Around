import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

export type Database = PrismaClient;

/** Row-lock transactions (join/leave) wait in the pool while other requests hold FOR UPDATE. */
export const lockedTx = { maxWait: 30_000, timeout: 30_000 } as const;

export function createPrismaClient(databaseUrl: string): Database {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 16,
    connectionTimeoutMillis: 10_000,
    ssl:
      sslMode === 'require' || sslMode === 'verify-full'
        ? { rejectUnauthorized: sslMode === 'verify-full' }
        : undefined,
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export async function checkDatabase(db: Database, timeoutMs = 2_000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const ping = db.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([ping, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
