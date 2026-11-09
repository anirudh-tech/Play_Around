'use client';

import { queryKeys } from '@playaround/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { asList, DataTable } from '@/components/data-table';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { when } from '@/lib/format';

type Report = {
  id: string;
  status: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
};
type Review = {
  id: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  reviewee?: { profile?: { displayName: string } | null };
};

export default function ReportsPage() {
  const client = useQueryClient();
  const reports = useQuery({ queryKey: queryKeys.admin.reports, queryFn: () => api.admin.reports() });
  const reviews = useQuery({ queryKey: queryKeys.admin.reviews, queryFn: () => api.admin.reviews() });
  const resolve = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      api.admin.patchReport(input.id, { status: 'ACTIONED', resolution: input.reason, reason: input.reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.admin.reports }),
  });
  const hide = useMutation({
    mutationFn: (input: { id: string; isHidden: boolean; reason: string }) =>
      api.admin.hideReview(input.id, { isHidden: input.isHidden, reason: input.reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.admin.reviews }),
  });

  return (
    <Shell>
      <h1 className="text-xl font-bold">Reports</h1>
      <div className="mt-4">
        <DataTable
          columns={['Target', 'Reason', 'Status', 'Opened', '']}
          empty={reports.isPending ? 'Loading…' : 'No reports.'}
          rows={asList<Report>(reports.data?.data).map((row) => [
            `${row.targetType} ${row.targetId.slice(0, 8)}`,
            row.reason,
            row.status,
            when(row.createdAt),
            row.status === 'OPEN' ? (
              <ReasonForm actionLabel="Action" onSubmit={(reason) => resolve.mutateAsync({ id: row.id, reason })} />
            ) : (
              '—'
            ),
          ])}
        />
      </div>
      <h2 className="mt-8 text-lg font-semibold">Reviews</h2>
      <div className="mt-3">
        <DataTable
          columns={['Reviewee', 'Rating', 'Comment', 'Hidden', '']}
          empty={reviews.isPending ? 'Loading…' : 'No reviews.'}
          rows={asList<Review>(reviews.data?.data).map((row) => [
            row.reviewee?.profile?.displayName ?? row.id,
            String(row.rating),
            row.comment ?? '—',
            row.isHidden ? 'yes' : 'no',
            <ReasonForm
              key={row.id}
              actionLabel={row.isHidden ? 'Unhide' : 'Hide'}
              onSubmit={(reason) => hide.mutateAsync({ id: row.id, isHidden: !row.isHidden, reason })}
            />,
          ])}
        />
      </div>
    </Shell>
  );
}
