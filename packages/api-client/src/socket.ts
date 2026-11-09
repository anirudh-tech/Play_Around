import { io, type Socket } from 'socket.io-client';

export interface SocketClient {
  connect: () => void;
  disconnect: () => void;
  subscribe: (sessionIds: string[]) => void;
  unsubscribe: (sessionIds: string[]) => void;
  on: (event: string, handler: (payload: unknown) => void) => () => void;
}

function originFrom(url: string) {
  return url.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
}

export function createSocketClient(options: {
  url: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}): SocketClient {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let socket: Socket | null = null;
  let subscribed: string[] = [];

  function dispatch(event: string, payload: unknown) {
    listeners.get(event)?.forEach((handler) => handler(payload));
  }

  return {
    connect() {
      if (socket) return;
      void Promise.resolve(options.getAccessToken?.() ?? null).then((token) => {
        socket = io(originFrom(options.url), {
          transports: ['websocket', 'polling'],
          auth: token ? { token } : {},
          withCredentials: true,
        });
        socket.onAny((event, payload) => dispatch(event, payload));
        socket.on('connect', () => {
          if (subscribed.length && socket) socket.emit('session:subscribe', { ids: subscribed });
          dispatch('connect', null);
        });
        socket.on('disconnect', () => dispatch('disconnect', null));
      });
    },
    disconnect() {
      socket?.disconnect();
      socket = null;
      listeners.clear();
      subscribed = [];
    },
    subscribe(sessionIds) {
      subscribed = [...new Set(sessionIds)].slice(0, 50);
      socket?.emit('session:subscribe', { ids: subscribed });
    },
    unsubscribe(sessionIds) {
      subscribed = subscribed.filter((id) => !sessionIds.includes(id));
      socket?.emit('session:unsubscribe', { ids: sessionIds });
    },
    on(event, handler) {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
      return () => set.delete(handler);
    },
  };
}
