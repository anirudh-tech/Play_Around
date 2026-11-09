'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { Chrome } from '@/components/chrome';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function NotificationsPage() {
  const token = useAuth((s) => s.accessToken);
  const list = useQuery({ queryKey: queryKeys.notifications, queryFn: () => api.notifications.list(), enabled: Boolean(token) });
  return (
    <RequireAuth>
    <Chrome>
      <h1 className="font-display text-3xl font-bold">Alerts</h1>
      <Button className="mt-4" onClick={() => void api.notifications.readAll().then(() => list.refetch())}>
        Mark all read
      </Button>
      <div className="mt-4 grid gap-2">
        {(list.data?.data ?? []).map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-text-muted">{item.body}</p>
          </div>
        ))}
        {token && list.data?.data.length === 0 ? <p className="text-text-muted">You're up to date.</p> : null}
      </div>
    </Chrome>
    </RequireAuth>
  );
}
