import { pino } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../src/config/env';
import { createEventBus } from '../src/lib/event-bus';
import { createJobRunner } from '../src/lib/job-runner';
import { smtpTransportOptions } from '../src/lib/mailer';
import { otpEmail } from '../src/lib/otp-email';
import { poolSslFromDatabaseUrl } from '../src/lib/prisma';

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
    expect(env.MAIL_USER).toBeUndefined();
  });

  it('keeps Gmail SMTP credentials when set', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      MAIL_USER: ' playaround@gmail.com ',
      MAIL_PASSWORD: ' app-password ',
    });
    expect(env.MAIL_USER).toBe('playaround@gmail.com');
    expect(env.MAIL_PASSWORD).toBe('app-password');
  });

  it('strips spaces from a Gmail App Password', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      MAIL_PASSWORD: 'abcd efgh ijkl mnop',
    });
    expect(env.MAIL_PASSWORD).toBe('abcdefghijklmnop');
  });

  it('rejects a missing or non-Postgres database URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/postgres/);
  });
});

describe('otpEmail', () => {
  it('puts the signup code in text and html', () => {
    const mail = otpEmail('EMAIL_VERIFY', '482193', 60);
    expect(mail.subject).toMatch(/signup/i);
    expect(mail.text).toContain('482193');
    expect(mail.html).toContain('482193');
    expect(mail.html).toContain('PLAYAROUND');
  });
});

describe('smtpTransportOptions', () => {
  it('uses STARTTLS and auth for Gmail submission', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      MAIL_HOST: 'smtp.gmail.com',
      MAIL_PORT: '587',
      MAIL_USER: 'playaround@gmail.com',
      MAIL_PASSWORD: 'app-password',
    });
    expect(smtpTransportOptions(env)).toMatchObject({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'playaround@gmail.com', pass: 'app-password' },
    });
  });

  it('omits auth for local Mailpit', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db' });
    expect(smtpTransportOptions(env).auth).toBeUndefined();
    expect(smtpTransportOptions(env).requireTLS).toBe(false);
  });
});

describe('poolSslFromDatabaseUrl', () => {
  it('leaves local Docker URLs without TLS', () => {
    expect(poolSslFromDatabaseUrl('postgresql://playaround:playaround@127.0.0.1:5433/playaround')).toBeUndefined();
  });

  it('enables TLS for Render public hosts and sslmode=require', () => {
    expect(
      poolSslFromDatabaseUrl('postgresql://u:p@dpg-abc.oregon-postgres.render.com/db'),
    ).toEqual({ rejectUnauthorized: false });
    expect(poolSslFromDatabaseUrl('postgresql://u:p@localhost:5432/db?sslmode=require')).toEqual({
      rejectUnauthorized: false,
    });
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
