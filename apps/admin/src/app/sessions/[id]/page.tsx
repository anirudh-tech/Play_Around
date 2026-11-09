'use client';

import { queryKeys } from '@playaround/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { when } from '@/lib/format';

type SessionDetail = {
  id: string;
  title: string;
  status: string;
  sessionType: string;
  startsAt: string;
  capacity: number;
  confirmedCount: number;
  cancellationReason?: string | null;
  sport?: { name: string };
  venue?: { name: string } | null;
  organiser?: { email: string; profile?: { displayName: string } | null };
  participants?: Array<{ userId: string; role: string; status: string; user?: { profile?: { displayName: string } | null } }>;
  events?: Array<{ id: string; type: string; createdAt: string }>;
};

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuth((s) => s.user?.role);
  const client = useQueryClient();
  const session = useQuery({
    queryKey: queryKeys.admin.session(id),
    queryFn: () => api.admin.session(id),
  });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.admin.session(id) });
  const cancel = useMutation({
    mutationFn: (reason: string) => api.admin.cancelSession(id, { reason }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (input: { userId: string; reason: string }) => api.admin.removeParticipant(id, input.userId, { reason: input.reason }),
    onSuccess: invalidate,
  });
  const data = session.data?.data as SessionDetail | undefined;
  const canCancel = role === 'OPERATIONS' || role === 'SUPER_ADMIN';

  return (
    <Shell>
      {session.isPending ? <p>Loading…</p> : null}
      {session.isError ? <p className="text-danger">Session not found.</p> : null}
      {data ? (
        <>
          <h1 className="text-xl font-bold">{data.title}</h1>
          <p className="text-sm text-text-muted">
            {data.sport?.name} · {data.sessionType} · {data.status} · {when(data.startsAt)} · {data.confirmedCount}/{data.capacity}
          </p>
          <p className="text-sm">Organiser {data.organiser?.profile?.displayName ?? data.organiser?.email}</p>
          <h2 className="mt-6 text-sm font-semibold">Participants</h2>
          <ul className="space-y-2 text-sm">
            {(data.participants ?? []).map((row) => (
              <li key={row.userId} className="flex items-center justify-between gap-3">
                <span>
                  {row.user?.profile?.displayName ?? row.userId} · {row.role} · {row.status}
                </span>
                {row.role !== 'ORGANISER' && row.status !== 'CANCELLED' ? (
                  <ReasonForm
                    actionLabel="Remove"
                    onSubmit={(reason) => remove.mutateAsync({ userId: row.userId, reason })}
                  />
                ) : null}
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-sm font-semibold">Timeline</h2>
          <ol className="text-sm">
            {(data.events ?? []).map((event) => (
              <li key={event.id}>
                {when(event.createdAt)} · {event.type}
              </li>
            ))}
          </ol>
          {canCancel && ['OPEN', 'FULL'].includes(data.status) ? (
            <div className="mt-6 max-w-md">
              <ReasonForm actionLabel="Cancel session" onSubmit={(reason) => cancel.mutateAsync(reason)} />
            </div>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}
