'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Chrome } from '@/components/chrome';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Chrome>
      <div className="glass mx-auto max-w-md rounded-xl p-6">
        <h1 className="font-display text-3xl font-bold">Reset password</h1>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <input className="mt-4 h-11 w-full rounded-lg border px-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {sent ? (
          <>
            <input className="mt-3 h-11 w-full rounded-lg border px-3" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
            <input type="password" className="mt-3 h-11 w-full rounded-lg border px-3" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button className="mt-4 w-full" onClick={() => void api.auth.resetPassword({ email, code, password }).then(() => router.push('/login')).catch((err) => setError(errorMessage(err)))}>
              Reset
            </Button>
          </>
        ) : (
          <Button className="mt-4 w-full" onClick={() => void api.auth.forgotPassword({ email }).then(() => setSent(true)).catch((err) => setError(errorMessage(err)))}>
            Send code
          </Button>
        )}
      </div>
    </Chrome>
  );
}
