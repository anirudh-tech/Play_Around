import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import type { NotificationType } from '@playaround/contracts';
import type { Database } from './prisma';

const NO_PUSH: NotificationType[] = ['REVIEW_RECEIVED'];

export interface PushGateway {
  send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
}

export function createExpoPush(accessToken?: string): PushGateway {
  const expo = new Expo({ accessToken: accessToken || undefined });
  return {
    send(messages) {
      return expo.sendPushNotificationsAsync(messages);
    },
  };
}

export function createMemoryPush() {
  const sent: ExpoPushMessage[] = [];
  return {
    sent,
    async send(messages: ExpoPushMessage[]) {
      sent.push(...messages);
      return messages.map(() => ({ status: 'ok' as const, id: `ticket-${sent.length}` }));
    },
  };
}

export function pushEnabled(prefs: unknown, type: NotificationType) {
  if (NO_PUSH.includes(type)) return false;
  if (!prefs || typeof prefs !== 'object') return true;
  const push = (prefs as { push?: Record<string, boolean> }).push;
  if (push && type in push) return push[type] !== false;
  return true;
}

export async function deliverPush(
  db: Database,
  gateway: PushGateway | undefined,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    notificationId: string;
    sessionId: string | null;
  },
) {
  const profile = await db.userProfile.findUnique({ where: { userId: input.userId } });
  if (!pushEnabled(profile?.notificationPrefs, input.type)) return;
  const devices = await db.device.findMany({ where: { userId: input.userId } });
  const tokens = devices.map((row) => row.pushToken).filter((token) => Expo.isExpoPushToken(token));
  if (!tokens.length) {
    await db.notification.updateMany({
      where: { id: input.notificationId, pushedAt: null },
      data: { pushedAt: new Date() },
    });
    return;
  }
  const pusher = gateway ?? createExpoPush();
  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    title: input.title,
    body: input.body,
    data: { notificationId: input.notificationId, sessionId: input.sessionId, type: input.type },
  }));
  const tickets = await pusher.send(messages);
  const invalid: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      const token = tokens[index];
      if (token) invalid.push(token);
    }
  });
  if (invalid.length) {
    await db.device.deleteMany({ where: { pushToken: { in: invalid } } });
  }
  await db.notification.update({
    where: { id: input.notificationId },
    data: { pushedAt: new Date() },
  });
}
