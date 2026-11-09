'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { asList, DataTable } from '@/components/data-table';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { inputClass, when } from '@/lib/format';

type SessionRow = {
  id: string;
  title: string;
  status: string;
  sessionType: string;
  startsAt: string;
  sport?: { name: string };
  venue?: { name: string } | null;
};

export default function SessionsPage() {
  const [q, setQ] = useState('');
  const sessions = useQuery({
    queryKey: queryKeys.admin.sessions(q),
    queryFn: () => api.admin.sessions({ q: q || undefined }),
  });
  const rows = asList<SessionRow>(sessions.data?.data);

  return (
    <Shell>
      <h1 className="text-xl font-bold">Sessions</h1>
      <input className={`${inputClass} max-w-sm`} placeholder="Search title" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4">
        <DataTable
          columns={['Title', 'Sport', 'Type', 'Status', 'Starts']}
          empty={sessions.isPending ? 'Loading…' : 'No sessions.'}
          rows={rows.map((row) => [
            <Link key={row.id} className="text-primary" href={`/sessions/${row.id}`}>
              {row.title}
            </Link>,
            row.sport?.name ?? '—',
            row.sessionType,
            row.status,
            when(row.startsAt),
          ])}
        />
      </div>
    </Shell>
  );
}
