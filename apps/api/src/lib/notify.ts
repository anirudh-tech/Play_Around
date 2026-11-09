import type { NotificationType } from '@playaround/contracts';
import type { Database } from './prisma';
import { deliverNotification, scheduleAfterCommit } from './realtime';

type Tx = Pick<Database, 'notification'>;

export async function notify(
  tx: Tx,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    sessionId?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
  },
) {
  if (input.userId === input.actorId) return;
  const row = await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      sessionId: input.sessionId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
  scheduleAfterCommit(() => deliverNotification(row.id));
}

export async function notifyMany(
  tx: Tx,
  userIds: string[],
  input: Omit<Parameters<typeof notify>[1], 'userId'>,
) {
  const unique = [...new Set(userIds)];
  for (const userId of unique) {
    await notify(tx, { ...input, userId });
  }
}
