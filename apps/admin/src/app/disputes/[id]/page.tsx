'use client';

import { queryKeys } from '@playaround/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Dispute = {
  id: string;
  status: string;
  reason: string;
  description: string | null;
  payment?: { status: string };
};

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuth((s) => s.user?.role);
  const client = useQueryClient();
  const dispute = useQuery({ queryKey: queryKeys.admin.dispute(id), queryFn: () => api.admin.dispute(id) });
  const resolve = useMutation({
    mutationFn: (reason: string) =>
      api.admin.resolveDispute(id, { resolutionStatus: 'PAID', note: reason, reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.admin.dispute(id) }),
  });
  const data = dispute.data?.data as Dispute | undefined;
  const canMutate = role === 'SUPPORT' || role === 'SUPER_ADMIN';

  return (
    <Shell>
      {dispute.isPending ? <p>Loading…</p> : null}
      {data ? (
        <>
          <h1 className="text-xl font-bold">Dispute {data.status}</h1>
          <p className="text-sm">{data.reason}</p>
          <p className="mt-2 text-sm text-text-muted">{data.description}</p>
          {canMutate && data.status === 'OPEN' ? (
            <div className="mt-6 max-w-md">
              <ReasonForm actionLabel="Resolve as paid" onSubmit={(reason) => resolve.mutateAsync(reason)} />
            </div>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}
