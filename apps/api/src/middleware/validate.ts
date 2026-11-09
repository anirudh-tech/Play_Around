import type { RequestHandler } from 'express';
import type { z } from 'zod';

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export type Validated<S extends Schemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.infer<S[K]> : never;
};

/**
 * Parses body, query and params with Zod. Parsed values are stored on `res.locals.validated`
 * because Express 5 makes `req.query` read-only. Failures reach the error handler as ZodError.
 */
export function validate<S extends Schemas>(schemas: S): RequestHandler {
  return (req, res, next) => {
    const validated: Record<string, unknown> = {};
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (schema) validated[key] = schema.parse(req[key]);
    }
    res.locals.validated = validated;
    next();
  };
}
