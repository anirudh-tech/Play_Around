import { z } from 'zod';

export const Uuid = z.uuid();

export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

export const HealthResponse = z.object({
  data: z.object({
    status: z.enum(['ok']),
    service: z.literal('playaround-api'),
    version: z.string(),
    uptimeSeconds: z.number(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ReadinessResponse = z.object({
  data: z.object({
    status: z.enum(['ready', 'not_ready']),
    checks: z.object({
      database: z.enum(['up', 'down']),
    }),
  }),
});
export type ReadinessResponse = z.infer<typeof ReadinessResponse>;
