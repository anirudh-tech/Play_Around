'use client';

import { useSignIn } from '@clerk/nextjs';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/format';

function GoogleSignInInner() {
  const { signIn, fetchStatus } = useSignIn();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="mt-4">
      {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
      <Button
        type="button"
        className="w-full"
        disabled={pending || fetchStatus === 'fetching'}
        onClick={() => {
          setPending(true);
          setError(null);
          void signIn
            .sso({
              strategy: 'oauth_google',
              redirectUrl: `${window.location.origin}/auth/bridge`,
              redirectCallbackUrl: `${window.location.origin}/sso-callback`,
            })
            .then((result) => {
              if (result.error) {
                setPending(false);
                setError(result.error.message);
              }
            })
            .catch((err: unknown) => {
              setPending(false);
              setError(errorMessage(err));
            });
        }}
      >
        Continue with Google
      </Button>
    </div>
  );
}

export function GoogleSignInButton() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  return <GoogleSignInInner />;
}
