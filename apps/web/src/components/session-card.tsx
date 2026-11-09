'use client';

import { BAND_LABELS } from '@playaround/api-client';
import type { NearbySession, SessionSummary } from '@playaround/contracts';
import Link from 'next/link';
import { shareLabel, when } from '@/lib/format';

export function SessionCard({ session }: { session: SessionSummary | NearbySession }) {
  const nearby = 'band' in session ? session : null;
  return (
    <Link
      href={`/sessions/${session.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition hover:border-primary"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color: session.sport.accentColor }}>
          {session.sport.name}
        </span>
        {nearby ? <span className="text-text-muted">{BAND_LABELS[nearby.band]}</span> : null}
      </div>
      <h3 className="mt-1 font-semibold">{session.title ?? session.location.label}</h3>
      <p className="mt-1 text-sm text-text-muted">
        {when(session.startsAt)} · {session.location.label} · {shareLabel(session.price.perPlayerMax?.amountFils)}
      </p>
      {session.venueConfirmationStatus === 'PENDING' ? (
        <span className="mt-2 inline-block rounded-full bg-warning/20 px-2 py-1 text-xs font-semibold">
          Venue being arranged
        </span>
      ) : null}
      <p className="mt-2 text-xs text-text-muted">{session.paymentNote}</p>
    </Link>
  );
}
