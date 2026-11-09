import nodemailer from 'nodemailer';
import type { Env } from '../config/env';
import type { Logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export function createSmtpMailer(env: Pick<Env, 'MAIL_HOST' | 'MAIL_PORT' | 'MAIL_FROM'>, logger: Logger): Mailer {
  const transport = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: false,
  });

  return {
    async send(message) {
      try {
        await transport.sendMail({
          from: env.MAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
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
