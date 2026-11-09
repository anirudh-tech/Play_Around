import { pino } from 'pino';
import type { Env } from '../config/env';

export type Logger = pino.Logger;

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.phone',
        '*.latitude',
        '*.longitude',
        '*.lat',
        '*.lng',
        'req.query.lat',
        'req.query.lng',
      ],
      censor: '[redacted]',
    },
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
  });
}
