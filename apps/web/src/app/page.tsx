import { ApiStatus } from '@/components/api-status';
import { HomeCta } from '@/components/home-cta';

const sports = [
  { name: 'Badminton', className: 'bg-sport-badminton' },
  { name: 'Football', className: 'bg-sport-football' },
  { name: 'Cricket', className: 'bg-sport-cricket' },
];

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-brand-400/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-sport-football/30 blur-3xl" />

      <section className="glass relative w-full max-w-lg rounded-xl p-8 shadow-xl">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">PlayAround</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Find a game near you.</h1>
        <p className="mt-3 text-text-muted">
          Discover badminton, football and cricket sessions in the UAE. Pay the organiser directly —
          PlayAround never collects your money.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {sports.map((sport) => (
            <span key={sport.name} className={`${sport.className} rounded-full px-3 py-1 text-xs font-semibold text-white`}>
              {sport.name}
            </span>
          ))}
        </div>
        <div className="mt-8 rounded-lg border border-border bg-surface/60 p-4">
          <ApiStatus />
        </div>
        <HomeCta />
        <p className="mt-6 text-xs text-text-muted">
          <a className="underline" href="/terms">
            Terms
          </a>
          {' · '}
          <a className="underline" href="/privacy">
            Privacy
          </a>
          {' · '}
          <a className="underline" href="/organiser-agreement">
            Organiser agreement
          </a>
        </p>
      </section>
    </main>
  );
}
