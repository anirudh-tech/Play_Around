import type { ApiErrorBody } from '@playaround/contracts';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import type { Logger } from '../lib/logger';

function body(error: AppError, requestId: string | null): ApiErrorBody {
  return {
    error: { code: error.code, message: error.message, details: error.details, requestId },
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  const underV1 = req.path === '/api/v1' || req.path.startsWith('/api/v1/');
  const hint =
    underV1 || req.path === '/health' || req.path.startsWith('/docs')
      ? ''
      : ` REST lives under /api/v1 (e.g. POST /api/v1${req.path === '/' ? '/auth/login' : req.path}).`;
  next(new AppError('NOT_FOUND', `No route for ${req.method} ${req.path}.${hint}`));
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    const requestId = req.id ? String(req.id) : null;
    let error: AppError;

    if (err instanceof AppError) {
      error = err;
    } else if (err instanceof ZodError) {
      error = new AppError('VALIDATION_ERROR', 'Request validation failed.', err.issues);
    } else if (isBodyParserError(err)) {
      error = new AppError('VALIDATION_ERROR', 'Malformed request body.');
    } else {
      logger.error({ err, requestId }, 'unhandled error');
      error = new AppError('INTERNAL_ERROR', 'Something went wrong.');
    }

    res.status(error.status).json(body(error, requestId));
  };
}

function isBodyParserError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')
  );
}
