import { pino } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../src/config/env';
import { createEventBus } from '../src/lib/event-bus';
import { createJobRunner } from '../src/lib/job-runner';

const logger = pino({ level: 'silent' });

describe('loadEnv', () => {
  it('applies defaults and splits CORS origins', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      CORS_ORIGINS: 'http://a.test, http://b.test',
    });
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.JOBS_ENABLED).toBe(true);
  });

  it('rejects a missing or non-Postgres database URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/postgres/);
  });
});

describe('event bus', () => {
  it('delivers to every subscriber even if one fails', async () => {
    const bus = createEventBus<{ ping: { n: number } }>(logger);
    const received: number[] = [];
    bus.subscribe('ping', () => {
      throw new Error('boom');
    });
    bus.subscribe('ping', ({ n }) => {
      received.push(n);
    });

    await bus.publish('ping', { n: 1 });
    expect(received).toEqual([1]);
  });

  it('supports unsubscribe', async () => {
    const bus = createEventBus<{ ping: null }>(logger);
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('ping', handler);
    unsubscribe();
    await bus.publish('ping', null);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('job runner', () => {
  afterEach(() => vi.useRealTimers());

  it('runs jobs on their interval without overlapping', async () => {
    vi.useFakeTimers();
    const runner = createJobRunner(logger);
    let active = 0;
    let maxActive = 0;
    let runs = 0;
    runner.register({
      name: 'slow',
      intervalMs: 10,
      run: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        runs++;
        await new Promise((resolve) => setTimeout(resolve, 25));
        active--;
      },
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(200);
    const stopped = runner.stop();
    await vi.advanceTimersByTimeAsync(50);
    await stopped;

    expect(runs).toBeGreaterThanOrEqual(3);
    expect(maxActive).toBe(1);
  });

  it('rejects duplicate job names', () => {
    const runner = createJobRunner(logger);
    const job = { name: 'a', intervalMs: 1000, run: async () => undefined };
    runner.register(job);
    expect(() => runner.register(job)).toThrow(/already registered/);
  });
});
