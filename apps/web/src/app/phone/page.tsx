'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Chrome } from '@/components/chrome';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';

export default function PhonePage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+971');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <RequireAuth>
    <Chrome>
      <div className="glass mx-auto max-w-md rounded-xl p-6">
        <h1 className="font-display text-3xl font-bold">Add a phone</h1>
        <p className="mt-2 text-sm text-text-muted">
          Local SMS is logged by the API (look for <code>sms stub</code> in the terminal). No real SMS is sent yet.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <input className="mt-4 h-11 w-full rounded-lg border border-border px-3" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {!sent ? (
          <Button className="mt-4 w-full" onClick={() => void api.users.sendPhone({ phone }).then(() => setSent(true)).catch((err) => setError(errorMessage(err)))}>
            Send code
          </Button>
        ) : (
          <>
            <input className="mt-3 h-11 w-full rounded-lg border border-border px-3" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SMS code" />
            <Button className="mt-4 w-full" onClick={() => void api.users.verifyPhone(code).then(() => router.push('/discover')).catch((err) => setError(errorMessage(err)))}>
              Verify
            </Button>
          </>
        )}
        <button className="mt-3 text-sm text-text-muted" onClick={() => router.push('/discover')}>
          Skip
        </button>
      </div>
    </Chrome>
    </RequireAuth>
  );
}
