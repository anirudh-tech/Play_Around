import Link from 'next/link';

export function UnpublishedLegal({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-xl p-8">
      <p className="text-sm font-semibold uppercase text-primary">PlayAround</p>
      <h1 className="mt-2 font-display text-3xl font-bold">{title}</h1>
      <p className="mt-4 text-text-muted">
        This document is <strong>not published</strong>. Drafting and legal approval are launch item L-05
        (DEC-038). Public launch cannot proceed until terms, privacy policy and the organiser agreement exist.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-primary">
        Back
      </Link>
    </main>
  );
}
