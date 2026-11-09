import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    // Default matches infrastructure/docker/docker-compose.yml so `prisma generate` works without a .env.
    url: process.env.DATABASE_URL ?? 'mysql://playaround:playaround@localhost:3306/playaround',
  },
});
