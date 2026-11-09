import type { ClientKind } from '@playaround/contracts';
import type { AuthedUser } from '../middleware/auth';

declare global {
  namespace Express {
    interface Locals {
      auth?: AuthedUser;
      client?: ClientKind;
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
