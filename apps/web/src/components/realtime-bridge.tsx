'use client';

import { bindRealtimeCache } from '@playaround/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { sockets } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function RealtimeBridge() {
  const client = useQueryClient();
  const token = useAuth((s) => s.accessToken);

  useEffect(() => {
    if (!token) {
      sockets.disconnect();
      return;
    }
    sockets.disconnect();
    sockets.connect();
    return bindRealtimeCache(client, sockets);
  }, [client, token]);

  return null;
}
