import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

type Versioned = { version?: number };

function newer(incoming: number | undefined, current: number | undefined) {
  if (incoming == null) return true;
  if (current == null) return true;
  return incoming > current;
}

export function applySessionAvailability(
  client: QueryClient,
  event: {
    id: string;
    status?: string;
    confirmedCount?: number;
    interestedCount?: number;
    spotsLeft?: number;
    joinable?: boolean;
    version?: number;
  },
) {
  client.setQueryData(queryKeys.session(event.id), (current: { data?: Record<string, unknown> & Versioned } | undefined) => {
    if (!current?.data) return current;
    if (!newer(event.version, current.data.version as number | undefined)) return current;
    return {
      ...current,
      data: {
        ...current.data,
        ...(event.status ? { status: event.status } : {}),
        ...(event.confirmedCount != null ? { confirmedCount: event.confirmedCount } : {}),
        ...(event.interestedCount != null ? { interestedCount: event.interestedCount } : {}),
        ...(event.spotsLeft != null ? { spotsLeft: event.spotsLeft } : {}),
        ...(event.joinable != null ? { joinable: event.joinable } : {}),
        ...(event.version != null ? { version: event.version } : {}),
      },
    };
  });
}

export function bindRealtimeCache(
  client: QueryClient,
  sockets: { on: (event: string, handler: (payload: unknown) => void) => () => void; connect: () => void },
) {
  sockets.connect();
  const unsub = [
    sockets.on('session:availability', (payload) => {
      const event = payload as { id?: string };
      if (event.id) applySessionAvailability(client, payload as Parameters<typeof applySessionAvailability>[1]);
    }),
    sockets.on('session:status', (payload) => {
      const event = payload as { id?: string; status?: string; version?: number };
      if (!event.id) return;
      applySessionAvailability(client, { id: event.id, status: event.status, version: event.version });
    }),
    sockets.on('session:updated', (payload) => {
      const event = payload as { id?: string };
      if (event.id) void client.invalidateQueries({ queryKey: queryKeys.session(event.id) });
    }),
    sockets.on('session:venue_confirmed', (payload) => {
      const event = payload as { id?: string };
      if (event.id) void client.invalidateQueries({ queryKey: queryKeys.session(event.id) });
    }),
    sockets.on('notification:new', () => {
      void client.invalidateQueries({ queryKey: queryKeys.notifications });
    }),
    sockets.on('notification:unread_count', () => {
      void client.invalidateQueries({ queryKey: queryKeys.unreadCount });
    }),
    sockets.on('payment:updated', (payload) => {
      const event = payload as { paymentId?: string; sessionId?: string };
      if (event.paymentId) void client.invalidateQueries({ queryKey: queryKeys.payment(event.paymentId) });
      if (event.sessionId) void client.invalidateQueries({ queryKey: queryKeys.sessionPayments(event.sessionId) });
    }),
    sockets.on('connect', () => {
      void client.invalidateQueries();
    }),
  ];
  return () => unsub.forEach((fn) => fn());
}
