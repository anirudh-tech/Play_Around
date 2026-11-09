'use client';

import { bindRealtimeCache } from '@playaround/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { sockets } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );
  const token = useAuth((s) => s.accessToken);
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (!token) {
      sockets.disconnect();
      return;
    }
    return bindRealtimeCache(queryClient, sockets);
  }, [queryClient, token]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
