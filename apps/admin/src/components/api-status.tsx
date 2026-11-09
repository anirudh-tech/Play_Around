'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ApiStatus() {
  const live = useQuery({
    queryKey: queryKeys.health.live,
    queryFn: ({ signal }) => api.health.live(signal),
    retry: false,
  });
  const ready = useQuery({
    queryKey: queryKeys.health.ready,
    queryFn: ({ signal }) => api.health.ready(signal),
    retry: false,
  });

  const rows = [
    {
      label: 'API',
      ok: live.isSuccess,
      pending: live.isPending,
      detail: live.data ? `v${live.data.data.version}` : 'unreachable',
    },
    {
      label: 'Database',
      ok: ready.data?.data.checks.database === 'up',
      pending: ready.isPending,
      detail: ready.data?.data.checks.database ?? 'unknown',
    },
  ];

  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-6">
          <span className="text-text-muted">{row.label}</span>
          <span className="flex items-center gap-2 font-medium">
            <span
              className={cn(
                'size-2 rounded-full',
                row.pending ? 'bg-ink-300' : row.ok ? 'bg-success' : 'bg-danger',
              )}
            />
            {row.pending ? 'checking…' : row.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
