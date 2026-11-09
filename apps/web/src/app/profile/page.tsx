'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Chrome } from '@/components/chrome';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ProfilePage() {
  const token = useAuth((s) => s.accessToken);
  const setSession = useAuth((s) => s.setSession);
  const me = useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => api.users.me(signal), enabled: Boolean(token) });
  const user = me.data?.data;
  return (
    <RequireAuth>
      <Chrome>
        <h1 className="font-display text-3xl font-bold">{user?.profile.displayName ?? 'Profile'}</h1>
        <p className="mt-2 text-text-muted">{user?.email}</p>
        <p className="mt-1 text-sm">
          Email {user?.emailVerifiedAt ? 'verified' : 'unverified'} · Phone {user?.phoneVerifiedAt ? 'verified' : 'not verified'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          {!user?.emailVerifiedAt ? (
            <Link href="/verify" className="text-primary">
              Verify email
            </Link>
          ) : null}
          {!user?.phoneVerifiedAt ? (
            <Link href="/phone" className="text-primary">
              Add phone
            </Link>
          ) : null}
        </div>
        <Button
          className="mt-6"
          variant="glass"
          onClick={() => {
            void api.auth.logout().finally(() => setSession(null));
          }}
        >
          Sign out
        </Button>
      </Chrome>
    </RequireAuth>
  );
}
