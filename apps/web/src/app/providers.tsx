'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { RealtimeBridge } from '@/components/realtime-bridge';
import { useAuth } from '@/lib/auth';

function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      {children}
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return <AppProviders>{children}</AppProviders>;
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInFallbackRedirectUrl="/auth/bridge"
      signUpFallbackRedirectUrl="/auth/bridge"
    >
      <AppProviders>{children}</AppProviders>
    </ClerkProvider>
  );
}
