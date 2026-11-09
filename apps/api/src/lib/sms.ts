import type { Logger } from './logger';

export interface SmsGateway {
  send(phone: string, body: string): Promise<void>;
}

/** O-13 is unresolved. Locally we log the code instead of sending SMS. */
export function createConsoleSms(logger: Logger): SmsGateway {
  return {
    async send(phone, body) {
      logger.info({ phone, body }, 'sms stub');
    },
  };
}

export function createMemorySms(): SmsGateway & { outbox: { phone: string; body: string }[] } {
  const outbox: { phone: string; body: string }[] = [];
  return {
    outbox,
    async send(phone, body) {
      outbox.push({ phone, body });
    },
  };
}
