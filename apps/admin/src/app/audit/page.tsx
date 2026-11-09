'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { asList, DataTable } from '@/components/data-table';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { when } from '@/lib/format';

type Log = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
  actor?: { email: string };
};

export default function AuditPage() {
  const logs = useQuery({ queryKey: queryKeys.admin.audit, queryFn: () => api.admin.auditLogs() });
  const rows = asList<Log>(logs.data?.data);

  return (
    <Shell>
      <h1 className="text-xl font-bold">Audit log</h1>
      <div className="mt-4">
        <DataTable
          columns={['When', 'Actor', 'Action', 'Target', 'Reason']}
          empty={logs.isPending ? 'Loading…' : 'No audit entries.'}
          rows={rows.map((row) => [
            when(row.createdAt),
            row.actor?.email ?? '—',
            row.action,
            `${row.targetType} ${row.targetId.slice(0, 8)}`,
            row.reason,
          ])}
        />
      </div>
    </Shell>
  );
}
