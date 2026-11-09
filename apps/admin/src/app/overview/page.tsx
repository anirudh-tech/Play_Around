'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';

type Metrics = {
  sessionsToday: number;
  fillRate: number;
  venueRequestsNearDeadline: number;
  openDisputes: number;
  minPlayerPending: number;
  openReports: number;
};

export default function OverviewPage() {
  const metrics = useQuery({
    queryKey: queryKeys.admin.metrics,
    queryFn: () => api.admin.metrics(),
  });
  const data = (metrics.data?.data ?? null) as Metrics | null;
  const chart = data
    ? [
        { name: 'Sessions today', value: data.sessionsToday },
        { name: 'Fill %', value: data.fillRate },
        { name: 'Venue deadlines', value: data.venueRequestsNearDeadline },
        { name: 'Disputes', value: data.openDisputes },
        { name: 'Min-player', value: data.minPlayerPending },
        { name: 'Reports', value: data.openReports },
      ]
    : [];

  return (
    <Shell>
      <h1 className="text-xl font-bold">Overview</h1>
      {metrics.isError ? <p className="mt-3 text-sm text-danger">Could not load metrics.</p> : null}
      {metrics.isPending ? <p className="mt-3 text-sm text-text-muted">Loading…</p> : null}
      {data ? (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {chart.map((item) => (
              <div key={item.name} className="rounded-md border border-border bg-surface p-3">
                <dt className="text-[11px] uppercase text-text-muted">{item.name}</dt>
                <dd className="text-2xl font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 h-56 rounded-md border border-border bg-surface p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} width={28} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--pa-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </Shell>
  );
}
