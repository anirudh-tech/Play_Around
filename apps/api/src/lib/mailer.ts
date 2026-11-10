import nodemailer from 'nodemailer';
import type { Env } from '../config/env';
import type { Logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export type MailEnv = Pick<
  Env,
  'MAIL_HOST' | 'MAIL_PORT' | 'MAIL_FROM' | 'MAIL_USER' | 'MAIL_PASSWORD' | 'MAIL_RESEND_API_KEY'
>;
export type SmtpEnv = MailEnv;

export function smtpTransportOptions(env: SmtpEnv) {
  const user = env.MAIL_USER;
  const pass = env.MAIL_PASSWORD;
  const port = env.MAIL_PORT;
  return {
    host: env.MAIL_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: user && pass ? { user, pass } : undefined,
  };
}

async function deliver(
  logger: Logger,
  message: Pick<MailMessage, 'to' | 'subject'>,
  run: () => Promise<void>,
) {
  try {
    await run();
    logger.info({ to: message.to, subject: message.subject }, 'mail sent');
  } catch (err) {
    logger.warn({ err, to: message.to, subject: message.subject }, 'mail send failed');
  }
}

/** HTTPS API. Render blocks outbound SMTP (Gmail :587 times out with ETIMEDOUT). */
export function createResendMailer(
  env: Pick<Env, 'MAIL_FROM' | 'MAIL_RESEND_API_KEY'>,
  logger: Logger,
  fetchImpl: typeof fetch = fetch,
): Mailer {
  const apiKey = env.MAIL_RESEND_API_KEY;
  if (!apiKey) throw new Error('MAIL_RESEND_API_KEY is required for Resend');

  return {
    async send(message) {
      await deliver(logger, message, async () => {
        const res = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.MAIL_FROM,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
        }
      });
    },
  };
}

export function createSmtpMailer(env: SmtpEnv, logger: Logger): Mailer {
  const transport = nodemailer.createTransport(smtpTransportOptions(env));

  return {
    async send(message) {
      await deliver(logger, message, async () => {
        await transport.sendMail({
          from: env.MAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      });
    },
  };
}

export function createMailer(env: MailEnv, logger: Logger): Mailer {
  if (env.MAIL_RESEND_API_KEY) return createResendMailer(env, logger);
  return createSmtpMailer(env, logger);
}

export function createMemoryMailer(): Mailer & { outbox: MailMessage[] } {
  const outbox: MailMessage[] = [];
  return {
    outbox,
    async send(message) {
      outbox.push(message);
    },
  };
}
