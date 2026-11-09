'use client';

import { queryKeys } from '@playaround/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { when } from '@/lib/format';

type UserDetail = {
  id: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  profile?: { displayName: string } | null;
  identities?: Array<{ provider: string }>;
  organisedSessions?: Array<{ id: string; title: string; status: string; startsAt: string }>;
  participations?: Array<{ status: string; session: { id: string; title: string } }>;
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuth((s) => s.user?.role);
  const client = useQueryClient();
  const user = useQuery({
    queryKey: queryKeys.admin.user(id),
    queryFn: () => api.admin.user(id),
  });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.admin.user(id) });
  const statusMut = useMutation({
    mutationFn: (input: { status: 'ACTIVE' | 'SUSPENDED'; reason: string }) => api.admin.setUserStatus(id, input),
    onSuccess: invalidate,
  });
  const roleMut = useMutation({
    mutationFn: (input: { role: 'SUPPORT' | 'OPERATIONS' | 'SUPER_ADMIN'; reason: string }) =>
      api.admin.setStaffRole(id, input),
    onSuccess: invalidate,
  });
  const data = user.data?.data as UserDetail | undefined;
  const canSuspend = role === 'OPERATIONS' || role === 'SUPER_ADMIN';
  const canRole = role === 'SUPER_ADMIN';

  return (
    <Shell>
      {user.isPending ? <p>Loading…</p> : null}
      {user.isError ? <p className="text-danger">User not found.</p> : null}
      {data ? (
        <>
          <h1 className="text-xl font-bold">{data.profile?.displayName ?? data.email}</h1>
          <p className="text-sm text-text-muted">
            {data.email} · {data.role} · {data.status} · phone {data.phone ?? 'none'}
          </p>
          <p className="mt-1 text-sm">
            Email {data.emailVerifiedAt ? 'verified' : 'unverified'} · Phone {data.phoneVerifiedAt ? 'verified' : 'unverified'} ·{' '}
            Identities {(data.identities ?? []).map((row) => row.provider).join(', ') || 'password'}
          </p>
          <h2 className="mt-6 text-sm font-semibold">Hosted</h2>
          <ul className="text-sm">
            {(data.organisedSessions ?? []).map((row) => (
              <li key={row.id}>
                {row.title} · {row.status} · {when(row.startsAt)}
              </li>
            ))}
          </ul>
          <h2 className="mt-4 text-sm font-semibold">Joined</h2>
          <ul className="text-sm">
            {(data.participations ?? []).map((row) => (
              <li key={row.session.id}>
                {row.session.title} · {row.status}
              </li>
            ))}
          </ul>
          {canSuspend ? (
            <div className="mt-6 max-w-md">
              <ReasonForm
                actionLabel={data.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                onSubmit={(reason) =>
                  statusMut.mutateAsync({ status: data.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED', reason })
                }
              />
            </div>
          ) : null}
          {canRole ? (
            <div className="mt-4 max-w-md">
              <ReasonForm
                actionLabel="Set OPERATIONS"
                onSubmit={(reason) => roleMut.mutateAsync({ role: 'OPERATIONS', reason })}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}
