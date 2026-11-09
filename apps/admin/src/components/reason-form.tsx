'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage, inputClass } from '@/lib/format';
import { Button } from './ui/button';

export function ReasonForm({
  actionLabel,
  extra,
  onSubmit,
}: {
  actionLabel: string;
  extra?: ReactNode;
  onSubmit: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    void onSubmit(reason)
      .then(() => setReason(''))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setPending(false));
  }

  return (
    <form className="space-y-2 rounded-md border border-border p-3" onSubmit={submit}>
      {extra}
      <label className="block text-[11px] font-semibold uppercase text-text-muted">Reason</label>
      <input className={inputClass} required minLength={1} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button size="sm" disabled={pending} type="submit">
        {actionLabel}
      </Button>
    </form>
  );
}
