import type { Logger } from './logger';

/**
 * Domain events, keyed by name. Modules add their events here as they are built.
 * Publish only after the database transaction has committed (persist first, then emit).
 */
export interface DomainEvents {
  'system.started': { at: Date };
}

type Handler<E, K extends keyof E> = (payload: E[K]) => void | Promise<void>;

export interface EventBus<E = DomainEvents> {
  subscribe<K extends keyof E>(type: K, handler: Handler<E, K>): () => void;
  publish<K extends keyof E>(type: K, payload: E[K]): Promise<void>;
}

export function createEventBus<E = DomainEvents>(logger: Logger): EventBus<E> {
  const handlers = new Map<keyof E, Set<Handler<E, keyof E>>>();

  return {
    subscribe(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as Handler<E, keyof E>);
      handlers.set(type, set);
      return () => set.delete(handler as Handler<E, keyof E>);
    },

    async publish(type, payload) {
      for (const handler of handlers.get(type) ?? []) {
        try {
          await handler(payload);
        } catch (error) {
          // A failing subscriber must not stop the others; the source change is already committed.
          logger.error({ err: error, event: String(type) }, 'event handler failed');
        }
      }
    },
  };
}
