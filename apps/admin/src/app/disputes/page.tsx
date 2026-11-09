'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { asList, DataTable } from '@/components/data-table';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { when } from '@/lib/format';

type Dispute = {
  id: string;
  status: string;
  reason: string;
  createdAt?: string;
  payment?: { session?: { title: string } };
};

export default function DisputesPage() {
  const list = useQuery({ queryKey: queryKeys.admin.disputes(), queryFn: () => api.admin.disputes() });
  const rows = asList<Dispute>(list.data?.data);

  return (
    <Shell>
      <h1 className="text-xl font-bold">Payment disputes</h1>
      <div className="mt-4">
        <DataTable
          columns={['Session', 'Reason', 'Status', 'Opened']}
          empty={list.isPending ? 'Loading…' : 'No disputes.'}
          rows={rows.map((row) => [
            <Link key={row.id} className="text-primary" href={`/disputes/${row.id}`}>
              {row.payment?.session?.title ?? row.id}
            </Link>,
            row.reason,
            row.status,
            when(row.createdAt),
          ])}
        />
      </div>
    </Shell>
  );
}
