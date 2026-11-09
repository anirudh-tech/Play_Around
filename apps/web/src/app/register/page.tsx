'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Chrome } from '@/components/chrome';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  return (
    <Chrome>
      <form
        className="glass mx-auto max-w-md rounded-xl p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (inFlight.current) return;
          inFlight.current = true;
          setPending(true);
          setError(null);
          void api.auth
            .register({ displayName, email, password })
            .then((result) => {
              setSession({
                accessToken: result.data.accessToken,
                refreshToken: result.data.refreshToken,
                user: result.data.user,
              });
              router.push('/verify');
            })
            .catch((err) => {
              inFlight.current = false;
              setError(errorMessage(err));
            })
            .finally(() => setPending(false));
        }}
      >
        <h1 className="font-display text-3xl font-bold">Join PlayAround</h1>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <input className="mt-4 h-11 w-full rounded-lg border border-border px-3" placeholder="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input className="mt-3 h-11 w-full rounded-lg border border-border px-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="mt-3 h-11 w-full rounded-lg border border-border px-3" placeholder="Password (10+)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button className="mt-5 w-full" disabled={pending} type="submit">
          Create account
        </Button>
      </form>
    </Chrome>
  );
}
