'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Chrome } from '@/components/chrome';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <RequireAuth>
    <Chrome>
      <form
        className="glass mx-auto max-w-md rounded-xl p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void api.auth
            .verifyEmail({ code })
            .then(() => router.push('/phone'))
            .catch((err) => setError(errorMessage(err)));
        }}
      >
        <h1 className="font-display text-3xl font-bold">Verify email</h1>
        <p className="mt-2 text-sm text-text-muted">Use the 6-digit code from Mailpit at localhost:8025.</p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <input className="mt-4 h-11 w-full rounded-lg border border-border px-3" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button className="mt-5 w-full" type="submit">
          Verify
        </Button>
        <button
          className="mt-3 w-full text-sm text-primary"
          type="button"
          onClick={() => {
            void api.auth.resendVerify().then(() => setError(null)).catch((err) => setError(errorMessage(err)));
          }}
        >
          Resend code
        </button>
      </form>
    </Chrome>
    </RequireAuth>
  );
}
