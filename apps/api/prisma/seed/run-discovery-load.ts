import 'dotenv/config';
import { loadEnv } from '../../src/config/env';
import { createPrismaClient } from '../../src/lib/prisma';
import { seedDiscoveryLoad } from './discovery-load';

const env = loadEnv();
const db = createPrismaClient(env.DATABASE_URL);

seedDiscoveryLoad(db, 100_000)
  .then((count) => {
    console.log(`discovery load seed: ${count} sessions`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
