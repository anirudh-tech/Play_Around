'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export function HomeCta() {
  const router = useRouter();
  const token = useAuth((s) => s.accessToken);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && token) router.replace('/discover');
  }, [hydrated, token, router]);

  if (hydrated && token) return null;

  return (
    <div className="mt-8 flex gap-3">
      <Link
        href="/discover"
        className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-text"
      >
        Discover sessions
      </Link>
      <Link href="/login" className="glass inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold">
        Sign in
      </Link>
    </div>
  );
}
