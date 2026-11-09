'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Chrome } from '@/components/chrome';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, shareLabel } from '@/lib/format';

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuth((s) => s.accessToken);
  const me = useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => api.users.me(signal), enabled: Boolean(token) });
  const payment = useQuery({ queryKey: queryKeys.payment(id), queryFn: () => api.payments.get(id) });
  const [error, setError] = useState<string | null>(null);
  const data = payment.data?.data;
  const userId = me.data?.data.id;

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await payment.refetch();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!data) {
    return (
      <Chrome>
        <p>{payment.isPending ? 'Loading…' : 'Payment not found.'}</p>
      </Chrome>
    );
  }

  return (
    <Chrome>
      <div className="glass mx-auto max-w-lg rounded-xl p-6">
        <h1 className="font-display text-3xl font-bold">{data.status.replaceAll('_', ' ')}</h1>
        <p className="mt-2 text-text-muted">
          {data.payer.displayName} → {data.payee.displayName} · {shareLabel(data.amountDue.amountFils)}
        </p>
        <p className="mt-3 text-sm">Pay the organiser directly. PlayAround doesn't collect payments.</p>
        {error ? <p className="mt-3 text-danger">{error}</p> : null}
        {userId === data.payer.id && data.status === 'UNPAID' ? (
          <Button className="mt-4" onClick={() => void run(() => api.payments.report(id, { method: 'CASH' }))}>
            I've paid
          </Button>
        ) : null}
        {userId === data.payee.id && (data.status === 'UNPAID' || data.status === 'PAYMENT_REPORTED') ? (
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void run(() => api.payments.confirm(id))}>Confirm</Button>
            <Button variant="glass" onClick={() => void run(() => api.payments.waive(id))}>
              Waive
            </Button>
          </div>
        ) : null}
        {userId === data.payee.id && data.status === 'PAID' ? (
          <Button className="mt-4" onClick={() => void run(() => api.payments.refund(id, { amountFils: data.amountPaid.amountFils }))}>
            Record refund
          </Button>
        ) : null}
      </div>
    </Chrome>
  );
}
