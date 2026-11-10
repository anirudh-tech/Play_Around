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

export type SmtpEnv = Pick<Env, 'MAIL_HOST' | 'MAIL_PORT' | 'MAIL_FROM' | 'MAIL_USER' | 'MAIL_PASSWORD'>;

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

export function createSmtpMailer(env: SmtpEnv, logger: Logger): Mailer {
  const transport = nodemailer.createTransport(smtpTransportOptions(env));

  return {
    async send(message) {
      try {
        await transport.sendMail({
          from: env.MAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      } catch (err) {
        logger.warn({ err, to: message.to, subject: message.subject }, 'mail send failed');
      }
    },
  };
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
