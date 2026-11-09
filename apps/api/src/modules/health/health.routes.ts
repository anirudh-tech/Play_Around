import type { HealthResponse, ReadinessResponse } from '@playaround/contracts';
import { Router } from 'express';

export interface HealthDeps {
  version: string;
  checkDatabase: () => Promise<boolean>;
}

export function createHealthRouter({ version, checkDatabase }: HealthDeps): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: HealthResponse = {
      data: {
        status: 'ok',
        service: 'playaround-api',
        version,
        uptimeSeconds: Math.round(process.uptime()),
      },
    };
    res.json(body);
  });

  router.get('/health/ready', async (_req, res) => {
    const databaseUp = await checkDatabase();
    const body: ReadinessResponse = {
      data: {
        status: databaseUp ? 'ready' : 'not_ready',
        checks: { database: databaseUp ? 'up' : 'down' },
      },
    };
    res.status(databaseUp ? 200 : 503).json(body);
  });

  return router;
}
