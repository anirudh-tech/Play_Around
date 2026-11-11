'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Chrome } from '@/components/chrome';
import { GoogleSignInButton } from '@/components/google-sign-in';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
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
            .login({ email, password })
            .then(async (result) => {
              setSession({
                accessToken: result.data.accessToken,
                refreshToken: result.data.refreshToken,
                user: result.data.user,
              });
              router.push(result.data.user.emailVerifiedAt ? '/discover' : '/verify');
            })
            .catch((err) => {
              inFlight.current = false;
              setError(errorMessage(err));
            })
            .finally(() => setPending(false));
        }}
      >
        <h1 className="font-display text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-text-muted">Pay organisers directly. PlayAround never collects money.</p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <label className="mt-4 block text-xs font-semibold uppercase">Email</label>
        <input className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mt-4 block text-xs font-semibold uppercase">Password</label>
        <input type="password" className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button className="mt-5 w-full" disabled={pending} type="submit">
          Sign in
        </Button>
        <GoogleSignInButton />
        <p className="mt-4 text-sm">
          <Link className="text-primary" href="/register">
            Create an account
          </Link>
          {' · '}
          <Link className="text-primary" href="/forgot">
            Forgot password
          </Link>
        </p>
        <p className="mt-3 text-xs text-text-muted">
          Google sign-in uses Clerk when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
        </p>
      </form>
    </Chrome>
  );
}
