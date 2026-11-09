'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { asList, DataTable } from '@/components/data-table';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { when } from '@/lib/format';

type Arrangement = {
  id: string;
  status: string;
  createdAt: string;
  session?: { id: string; title: string; startsAt: string };
  assignedTo?: { profile?: { displayName: string } | null } | null;
};

export default function ArrangementsPage() {
  const list = useQuery({
    queryKey: queryKeys.admin.arrangements(),
    queryFn: () => api.admin.arrangements(),
  });
  const rows = asList<Arrangement>(list.data?.data);

  return (
    <Shell>
      <h1 className="text-xl font-bold">Venue arrangements</h1>
      <div className="mt-4">
        <DataTable
          columns={['Session', 'Status', 'Assignee', 'Starts']}
          empty={list.isPending ? 'Loading…' : 'Queue is empty.'}
          rows={rows.map((row) => [
            <Link key={row.id} className="text-primary" href={`/arrangements/${row.id}`}>
              {row.session?.title ?? row.id}
            </Link>,
            row.status,
            row.assignedTo?.profile?.displayName ?? 'unassigned',
            when(row.session?.startsAt),
          ])}
        />
      </div>
    </Shell>
  );
}
