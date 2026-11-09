'use client';

import { ApiClientError } from '@playaround/api-client';
import type { AuthTokens } from '@playaround/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiStatus } from '@/components/api-status';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, inputClass } from '@/lib/format';

type Enrolment = { secret: string; otpauthUri: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('admin@playaround.local');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function finish(result: { data: AuthTokens }) {
    setSession({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      user: result.data.user,
    });
    router.replace('/overview');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Staff sign-in</h1>
        <p className="mt-2 text-sm text-text-muted">Password plus mandatory TOTP. Staff only.</p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        {!mfaToken ? (
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              setError(null);
              void api.admin
                .login({ email, password })
                .then(() => setError('Unexpected login response.'))
                .catch((err) => {
                  if (err instanceof ApiClientError && err.code === 'MFA_REQUIRED') {
                    const details = err.details as { mfaToken?: string; enrolment?: Enrolment };
                    setMfaToken(details.mfaToken ?? null);
                    setEnrolment(details.enrolment ?? null);
                    return;
                  }
                  setError(errorMessage(err));
                })
                .finally(() => setPending(false));
            }}
          >
            <label className="block text-[11px] font-semibold uppercase">Email</label>
            <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <label className="block text-[11px] font-semibold uppercase">Password</label>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Button className="w-full" disabled={pending} type="submit">
              Continue
            </Button>
          </form>
        ) : enrolment && !recoveryCodes ? (
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              setError(null);
              void api.admin
                .enrolMfa({ mfaToken, code })
                .then((result) => {
                  setRecoveryCodes(result.data.recoveryCodes);
                  setCode('');
                })
                .catch((err) => setError(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            <p className="text-sm">Scan this secret in your authenticator, then enter the 6-digit code.</p>
            <code className="block break-all rounded-md bg-background p-2 text-xs">{enrolment.secret}</code>
            <p className="break-all text-[11px] text-text-muted">{enrolment.otpauthUri}</p>
            <input className={inputClass} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            <Button className="w-full" disabled={pending} type="submit">
              Enrol authenticator
            </Button>
          </form>
        ) : recoveryCodes ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm">Store these recovery codes, then sign in again with a TOTP code.</p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-xs">
              {recoveryCodes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Button
              className="w-full"
              type="button"
              onClick={() => {
                setRecoveryCodes(null);
                setEnrolment(null);
                setMfaToken(null);
                setCode('');
              }}
            >
              Continue to TOTP
            </Button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              setError(null);
              const run = recovery
                ? api.admin.recoverMfa({ mfaToken, recoveryCode: recovery })
                : api.admin.verifyMfa({ mfaToken, code });
              void run
                .then((result) => finish(result))
                .catch((err) => setError(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            <label className="block text-[11px] font-semibold uppercase">Authenticator code</label>
            <input className={inputClass} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            <label className="block text-[11px] font-semibold uppercase">Or recovery code</label>
            <input className={inputClass} value={recovery} onChange={(e) => setRecovery(e.target.value)} />
            <Button className="w-full" disabled={pending} type="submit">
              Verify
            </Button>
          </form>
        )}

        <div className="mt-6 rounded-lg border border-border p-4">
          <ApiStatus />
        </div>
      </section>
    </main>
  );
}
