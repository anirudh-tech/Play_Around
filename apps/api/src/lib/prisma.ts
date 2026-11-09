import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

export type Database = PrismaClient;

/** Row-lock transactions (join/leave) wait in the pool while other requests hold FOR UPDATE. */
export const lockedTx = { maxWait: 30_000, timeout: 30_000 } as const;

export function createPrismaClient(databaseUrl: string): Database {
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 16,
    connectTimeout: 10_000,
    acquireTimeout: 30_000,
  });
  return new PrismaClient({ adapter });
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
