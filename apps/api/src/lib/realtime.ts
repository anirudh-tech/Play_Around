import type { Server as HttpServer } from 'node:http';
import { STAFF_ROLES, type NotificationType, type SessionSummary } from '@playaround/contracts';
import type { Server as SocketServer, Socket } from 'socket.io';
import { Server } from 'socket.io';
import type { Env } from '../config/env';
import { verifyAccessToken } from './tokens';
import type { Logger } from './logger';
import type { Database } from './prisma';
import { deliverPush, type PushGateway } from './push';

const MAX_SESSION_SUBS = 50;
const SESSION_ROOM = /^session:[0-9a-f-]{36}$/i;

type RealtimeDeps = {
  env: Pick<Env, 'JWT_SECRET' | 'CORS_ORIGINS' | 'EXPO_ACCESS_TOKEN'>;
  db: Database;
  logger: Logger;
  push?: PushGateway;
};

let io: SocketServer | null = null;
let deps: RealtimeDeps | null = null;

export function configureRealtime(next: RealtimeDeps) {
  deps = next;
}

export function getRealtimeIo() {
  return io;
}

export function attachRealtime(httpServer: HttpServer, options: RealtimeDeps) {
  configureRealtime(options);
  io = new Server(httpServer, {
    cors: { origin: options.env.CORS_ORIGINS, credentials: true },
  });

  io.use(async (socket, next) => {
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
    if (!token) {
      socket.data.user = null;
      next();
      return;
    }
    try {
      const claims = await verifyAccessToken(options.env, token);
      const user = await options.db.user.findUnique({ where: { id: claims.sub } });
      if (!user || user.status !== 'ACTIVE') {
        next(new Error('UNAUTHENTICATED'));
        return;
      }
      socket.data.user = { id: user.id, role: user.role, scope: claims.scope };
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as { id: string; role: string; scope: string } | null;
    if (user) {
      void socket.join(`user:${user.id}`);
      if (user.scope === 'admin' && (STAFF_ROLES as readonly string[]).includes(user.role)) {
        void socket.join('admin');
      }
    }
    socket.on('session:subscribe', (body: { ids?: unknown }) => {
      applySessionSubs(socket, body?.ids, 'join');
    });
    socket.on('session:unsubscribe', (body: { ids?: unknown }) => {
      applySessionSubs(socket, body?.ids, 'leave');
    });
  });

  return io;
}

function applySessionSubs(socket: Socket, raw: unknown, action: 'join' | 'leave') {
  const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
  const unique = [...new Set(ids)].slice(0, MAX_SESSION_SUBS);
  for (const id of unique) {
    const room = `session:${id}`;
    if (!SESSION_ROOM.test(room)) continue;
    if (action === 'join') void socket.join(room);
    else void socket.leave(room);
  }
}

export function emitSessionAvailability(summary: Pick<
  SessionSummary,
  'id' | 'status' | 'confirmedCount' | 'interestedCount' | 'spotsLeft' | 'joinable' | 'version'
>) {
  io?.to(`session:${summary.id}`).emit('session:availability', {
    id: summary.id,
    status: summary.status,
    confirmedCount: summary.confirmedCount,
    interestedCount: summary.interestedCount,
    spotsLeft: summary.spotsLeft,
    joinable: summary.joinable,
    version: summary.version,
  });
}

export function emitSessionStatus(summary: Pick<SessionSummary, 'id' | 'status' | 'venueConfirmationStatus' | 'version'> & {
  cancellationReason?: string | null;
}) {
  io?.to(`session:${summary.id}`).emit('session:status', {
    id: summary.id,
    status: summary.status,
    venueConfirmationStatus: summary.venueConfirmationStatus,
    cancellationReason: summary.cancellationReason ?? undefined,
    version: summary.version,
  });
}

export function emitSessionUpdated(sessionId: string, version: number, changedFields: string[]) {
  io?.to(`session:${sessionId}`).emit('session:updated', { id: sessionId, changedFields, version });
}

export function emitVenueConfirmed(summary: SessionSummary) {
  io?.to(`session:${summary.id}`).emit('session:venue_confirmed', {
    id: summary.id,
    location: summary.location,
    price: summary.price,
    startsAt: summary.startsAt,
    endsAt: summary.endsAt,
    version: summary.version,
  });
  emitSessionAvailability(summary);
  emitSessionStatus(summary);
}

export function emitParticipantJoined(sessionId: string, userId: string, version: number) {
  io?.to(`session:${sessionId}`).emit('session:participant_joined', { sessionId, userId, version });
}

export function emitParticipantLeft(sessionId: string, userId: string, version: number) {
  io?.to(`session:${sessionId}`).emit('session:participant_left', { sessionId, userId, version });
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitAdminFeed(payload: { kind: string; refId: string; summary: string }) {
  io?.to('admin').emit('admin:feed', payload);
}

export function emitPaymentUpdated(input: {
  payerId: string;
  payeeId: string;
  paymentId: string;
  sessionId: string;
  status: string;
  amountDueFils: number;
  version: number;
}) {
  const payload = {
    paymentId: input.paymentId,
    sessionId: input.sessionId,
    status: input.status,
    amountDueFils: input.amountDueFils,
    version: input.version,
  };
  emitToUser(input.payerId, 'payment:updated', payload);
  emitToUser(input.payeeId, 'payment:updated', payload);
}

export function scheduleAfterCommit(task: () => Promise<void>) {
  setImmediate(() => {
    void task().catch((error: unknown) => {
      deps?.logger.error({ err: error }, 'realtime after-commit task failed');
    });
  });
}

export async function deliverNotification(notificationId: string) {
  if (!deps) return;
  const row = await deps.db.notification.findUnique({ where: { id: notificationId } });
  if (!row) return;
  const unread = await deps.db.notification.count({ where: { userId: row.userId, readAt: null } });
  emitToUser(row.userId, 'notification:new', {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    sessionId: row.sessionId,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  });
  emitToUser(row.userId, 'notification:unread_count', { count: unread });

  if (row.entityType === 'payment' && row.entityId) {
    const payment = await deps.db.payment.findUnique({ where: { id: row.entityId } });
    if (payment) {
      emitPaymentUpdated({
        payerId: payment.payerId,
        payeeId: payment.payeeId,
        paymentId: payment.id,
        sessionId: payment.sessionId,
        status: payment.status,
        amountDueFils: payment.amountDueFils,
        version: payment.version,
      });
    }
  }

  if (row.entityType === 'price_consent') {
    emitToUser(row.userId, 'price_consent:required', {
      consentId: row.entityId,
      sessionId: row.sessionId,
    });
  }

  await deliverPush(deps.db, deps.push, {
    userId: row.userId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    notificationId: row.id,
    sessionId: row.sessionId,
  });
}
