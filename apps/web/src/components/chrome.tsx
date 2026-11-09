'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export function Chrome({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.accessToken);
  const hydrated = useAuth((s) => s.hydrated);
  return (
    <div className="min-h-dvh bg-background text-text">
      <header className="glass sticky top-0 z-20 border-b border-glass-border">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href={hydrated && token ? '/discover' : '/'} className="font-display text-lg font-bold">
            PlayAround
          </Link>
          <div className="flex gap-4 text-sm font-medium">
            <Link href="/discover">Discover</Link>
            <Link href="/create">Create</Link>
            <Link href="/activities">Activities</Link>
            <Link href="/notifications">Alerts</Link>
            {!hydrated ? (
              <span className="inline-block w-16" aria-hidden />
            ) : token ? (
              <Link href="/profile">Profile</Link>
            ) : (
              <Link href="/login">Sign in</Link>
            )}
          </div>
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
