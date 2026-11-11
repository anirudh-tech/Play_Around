'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { Chrome } from '@/components/chrome';

export default function SsoCallbackPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <Chrome>
        <p className="text-sm text-text-muted">Clerk is not configured.</p>
      </Chrome>
    );
  }
  return (
    <Chrome>
      <p className="text-sm text-text-muted">Finishing Google sign-in…</p>
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/auth/bridge"
        signUpForceRedirectUrl="/auth/bridge"
        signInFallbackRedirectUrl="/auth/bridge"
        signUpFallbackRedirectUrl="/auth/bridge"
      />
    </Chrome>
  );
}
