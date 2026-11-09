'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Chrome } from '@/components/chrome';
import { Button } from '@/components/ui/button';
import { api, sockets } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, shareLabel, when } from '@/lib/format';

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuth((s) => s.accessToken);
  const me = useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => api.users.me(signal), enabled: Boolean(token) });
  const session = useQuery({ queryKey: queryKeys.session(id), queryFn: ({ signal }) => api.sessions.get(id, signal) });
  const participants = useQuery({ queryKey: queryKeys.participants(id), queryFn: () => api.sessions.participants(id), enabled: Boolean(token) });
  const payments = useQuery({
    queryKey: queryKeys.sessionPayments(id),
    queryFn: () => api.payments.forSession(id),
    enabled: Boolean(token && session.data?.data.organiser.id === me.data?.data.id),
  });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    sockets.subscribe([id]);
    return () => sockets.unsubscribe([id]);
  }, [id]);

  const data = session.data?.data;
  const isOrganiser = data && me.data?.data.id === data.organiser.id;
  const mine = participants.data?.data.find((row) => row.userId === me.data?.data.id);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await Promise.all([session.refetch(), participants.refetch(), payments.refetch()]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!data) {
    return (
      <Chrome>
        <p>{session.isPending ? 'Loading…' : 'Session not found.'}</p>
      </Chrome>
    );
  }

  return (
    <Chrome>
      <article className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="glass rounded-xl p-6">
          <p className="text-xs font-semibold" style={{ color: data.sport.accentColor }}>
            {data.sport.name}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">{data.title ?? data.location.label}</h1>
          <p className="mt-2 text-text-muted">
            {when(data.startsAt)} · {data.location.label} · {shareLabel(data.price.perPlayerMax?.amountFils)}
          </p>
          {data.venueConfirmationStatus === 'PENDING' ? (
            <p className="mt-3 rounded-lg bg-warning/20 p-3 text-sm">Venue being arranged. Interest holds no spot.</p>
          ) : null}
          <p className="mt-3 text-sm">{data.paymentNote}</p>
          {error ? <p className="mt-3 text-danger">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!token ? (
              <Button onClick={() => router.push('/login')}>Sign in to join</Button>
            ) : data.venueConfirmationStatus === 'PENDING' && !isOrganiser ? (
              <Button onClick={() => void run(() => api.sessions.interest(id, true))}>I'm interested</Button>
            ) : mine ? (
              <Button variant="glass" onClick={() => void run(() => api.sessions.leave(id))}>
                Leave
              </Button>
            ) : data.joinable ? (
              <Button onClick={() => void run(() => api.sessions.join(id))}>Join</Button>
            ) : null}
            {isOrganiser ? <Button variant="glass" onClick={() => void run(() => api.sessions.cancel(id, { note: 'Cancelled from web' }))}>Cancel session</Button> : null}
          </div>
        </div>
        <aside className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">Players</h2>
          {(participants.data?.data ?? []).map((row) => (
            <div key={row.userId} className="mt-2 flex justify-between text-sm">
              <span>{row.displayName}</span>
              <span className="text-text-muted">{row.paymentStatus ?? row.status}</span>
            </div>
          ))}
          {isOrganiser && payments.data ? (
            <div className="mt-6">
              <h2 className="font-semibold">Payments</h2>
              {payments.data.data.payments.map((payment) => (
                <a key={payment.id} href={`/payments/${payment.id}`} className="mt-2 block rounded-lg bg-background p-2 text-sm">
                  {payment.payer.displayName} · {payment.status} · {shareLabel(payment.amountDue.amountFils)}
                </a>
              ))}
            </div>
          ) : null}
        </aside>
      </article>
    </Chrome>
  );
}
