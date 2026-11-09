'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { NAV, canAccess } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAuth((s) => s.accessToken);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const setSession = useAuth((s) => s.setSession);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      router.replace('/');
      return;
    }
    if (user) return;
    void api.users
      .me()
      .then((result) => setSession({ accessToken, user: result.data }))
      .catch(() => setSession(null));
  }, [hydrated, accessToken, user, router, setSession]);

  const role = user?.role;

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface p-3 md:block">
        <p className="px-2 text-sm font-bold">PlayAround Admin</p>
        <p className="px-2 text-[11px] text-text-muted">{user?.email ?? '…'}</p>
        <nav className="mt-4 space-y-0.5">
          {NAV.filter((item) => canAccess(role, item.href)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md px-2 py-1.5 text-sm',
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-text-muted hover:bg-background',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Button
          className="mt-6 w-full"
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => {
            void api.admin.logout().finally(() => {
              setSession(null);
              router.replace('/');
            });
          }}
        >
          Sign out
        </Button>
      </aside>
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
