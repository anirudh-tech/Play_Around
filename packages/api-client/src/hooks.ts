import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { bindRealtimeCache } from './cache';
import type { ApiClient } from './client';
import { queryKeys } from './query-keys';
import type { SocketClient } from './socket';

export function createSessionHooks(api: ApiClient) {
  return {
    useMe: () =>
      useQuery({
        queryKey: queryKeys.me,
        queryFn: ({ signal }: { signal?: AbortSignal }) => api.users.me(signal),
        retry: false,
      }),
    useSports: () =>
      useQuery({
        queryKey: queryKeys.sports,
        queryFn: () => api.catalog.sports(),
      }),
    useNearby: (params: Record<string, string | number | boolean | undefined>, enabled = true) =>
      useQuery({
        queryKey: queryKeys.nearby(params),
        queryFn: ({ signal }: { signal?: AbortSignal }) => api.sessions.nearby(params, signal),
        enabled,
      }),
    useSession: (id: string) =>
      useQuery({
        queryKey: queryKeys.session(id),
        queryFn: ({ signal }: { signal?: AbortSignal }) => api.sessions.get(id, signal),
        enabled: Boolean(id),
      }),
    useMySessions: (role: string, bucket: string) =>
      useQuery({
        queryKey: queryKeys.mySessions(role, bucket),
        queryFn: () => api.sessions.mine(role, bucket),
      }),
    useNotifications: () =>
      useQuery({
        queryKey: queryKeys.notifications,
        queryFn: () => api.notifications.list(),
      }),
    useInvalidate: () => {
      const client = useQueryClient();
      return () => client.invalidateQueries();
    },
    useRealtime: (sockets: SocketClient, enabled = true) => {
      const client = useQueryClient();
      useEffect(() => {
        if (!enabled) return;
        return bindRealtimeCache(client, sockets);
      }, [client, sockets, enabled]);
    },
    useSessionRoom: (sockets: SocketClient, sessionId?: string) => {
      useEffect(() => {
        if (!sessionId) return;
        sockets.subscribe([sessionId]);
        return () => sockets.unsubscribe([sessionId]);
      }, [sockets, sessionId]);
    },
    useJoin: () => {
      const client = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => api.sessions.join(id),
        onSuccess: () => client.invalidateQueries(),
      });
    },
  };
}
