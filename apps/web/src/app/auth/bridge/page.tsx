'use client';

import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Chrome } from '@/components/chrome';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';

function ClerkBridgeInner() {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useClerkAuth();
  const setSession = useAuth((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    if (!isSignedIn) {
      router.replace('/login');
      return;
    }
    started.current = true;
    void (async () => {
      try {
        const sessionToken = await getToken();
        if (!sessionToken) throw new Error('Clerk session missing.');
        const result = await api.auth.clerk(sessionToken);
        setSession({
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
          user: result.data.user,
        });
        router.replace('/discover');
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [getToken, isLoaded, isSignedIn, router, setSession]);

  return (
    <Chrome>
      <p className="text-sm text-text-muted">{error ?? 'Signing you into PlayAround…'}</p>
    </Chrome>
  );
}

export default function ClerkBridgePage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <Chrome>
        <p className="text-sm text-text-muted">Clerk is not configured.</p>
      </Chrome>
    );
  }
  return <ClerkBridgeInner />;
}
