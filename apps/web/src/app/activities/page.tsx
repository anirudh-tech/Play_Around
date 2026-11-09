'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Chrome } from '@/components/chrome';
import { RequireAuth } from '@/components/require-auth';
import { SessionCard } from '@/components/session-card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ActivitiesPage() {
  const token = useAuth((s) => s.accessToken);
  const [role, setRole] = useState('joined');
  const [bucket, setBucket] = useState('upcoming');
  const list = useQuery({
    queryKey: queryKeys.mySessions(role, bucket),
    queryFn: () => api.sessions.mine(role, bucket),
    enabled: Boolean(token),
  });
  return (
    <RequireAuth>
    <Chrome>
      <h1 className="font-display text-3xl font-bold">Activities</h1>
      {!token ? <p className="mt-4">Sign in to see your sessions.</p> : null}
      <div className="mt-4 flex gap-2">
        {['joined', 'organised', 'interested'].map((item) => (
          <button key={item} className={`rounded-full px-3 py-1 ${role === item ? 'bg-primary text-primary-text' : 'bg-surface'}`} onClick={() => setRole(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {['upcoming', 'completed', 'cancelled'].map((item) => (
          <button key={item} className={`rounded-full px-3 py-1 ${bucket === item ? 'bg-ink-900 text-white' : 'bg-surface'}`} onClick={() => setBucket(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-3">
        {(list.data?.data ?? []).length === 0 ? <p className="text-text-muted">Nothing here yet.</p> : null}
        {(list.data?.data ?? []).map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </Chrome>
    </RequireAuth>
  );
}
