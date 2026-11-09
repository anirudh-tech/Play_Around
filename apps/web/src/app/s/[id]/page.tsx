import type { Metadata } from 'next';
import { SessionSummaryResponse } from '@playaround/contracts';
import Link from 'next/link';
import { Chrome } from '@/components/chrome';
import { when, shareLabel } from '@/lib/format';

const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function load(id: string) {
  const res = await fetch(`${base}/sessions/${id}`, { next: { revalidate: 30 } });
  if (!res.ok) return null;
  const parsed = SessionSummaryResponse.safeParse(await res.json());
  return parsed.success ? parsed.data.data : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await load(id);
  const title = session ? `${session.title ?? session.location.label} · PlayAround` : 'PlayAround session';
  return {
    title,
    description: session ? `${session.sport.name} in ${session.location.label}. Pay the organiser directly.` : 'Find a game near you.',
    openGraph: { title, description: 'Join this PlayAround session in the UAE.' },
  };
}

export default async function PublicSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await load(id);
  if (!session) {
    return (
      <Chrome>
        <p>This session is not available.</p>
      </Chrome>
    );
  }
  return (
    <Chrome>
      <article className="glass mx-auto max-w-xl rounded-xl p-8">
        <p className="text-sm font-semibold" style={{ color: session.sport.accentColor }}>
          {session.sport.name}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">{session.title ?? session.location.label}</h1>
        <p className="mt-2 text-text-muted">
          {when(session.startsAt)} · {session.location.label} · {shareLabel(session.price.perPlayerMax?.amountFils)}
        </p>
        <p className="mt-4 text-sm">{session.paymentNote}</p>
        <Link className="mt-6 inline-block text-primary" href={`/sessions/${id}`}>
          Open in PlayAround
        </Link>
      </article>
    </Chrome>
  );
}
