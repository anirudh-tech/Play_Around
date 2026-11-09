'use client';

import { BAND_LABELS, DEFAULT_MAP_CENTER, queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Chrome } from '@/components/chrome';
import { SessionCard } from '@/components/session-card';
import { api, sockets } from '@/lib/api';
import { errorMessage } from '@/lib/format';

export default function DiscoverPage() {
  const [sportId, setSportId] = useState<number | undefined>();
  const [joinableOnly, setJoinableOnly] = useState(false);
  const sports = useQuery({ queryKey: queryKeys.sports, queryFn: () => api.catalog.sports() });
  const params = useMemo(
    () => ({
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      autoExpand: true,
      joinableOnly,
      ...(sportId ? { sportIds: String(sportId) } : {}),
    }),
    [joinableOnly, sportId],
  );
  const nearby = useQuery({
    queryKey: queryKeys.nearby(params),
    queryFn: ({ signal }) => api.sessions.nearby(params, signal),
  });
  useEffect(() => {
    const ids = (nearby.data?.data ?? []).map((row) => row.id);
    if (ids.length) sockets.subscribe(ids);
  }, [nearby.data]);

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof nearby.data>['data']>();
    for (const row of nearby.data?.data ?? []) {
      const list = map.get(row.band) ?? [];
      list.push(row);
      map.set(row.band, list);
    }
    return [...map.entries()];
  }, [nearby.data]);

  return (
    <Chrome>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr_280px]">
        <aside className="glass h-fit rounded-xl p-4">
          <h2 className="font-semibold">Filters</h2>
          <p className="mt-1 text-xs text-text-muted">Near {DEFAULT_MAP_CENTER.label}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`rounded-full px-3 py-1 text-sm ${!sportId ? 'bg-primary text-primary-text' : 'bg-surface'}`} onClick={() => setSportId(undefined)}>
              All
            </button>
            {(sports.data?.data ?? []).map((sport) => (
              <button
                key={sport.id}
                className={`rounded-full px-3 py-1 text-sm ${sportId === sport.id ? 'bg-primary text-primary-text' : 'bg-surface'}`}
                onClick={() => setSportId(sport.id)}
              >
                {sport.name}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={joinableOnly} onChange={(e) => setJoinableOnly(e.target.checked)} />
            Joinable only
          </label>
        </aside>
        <section>
          {nearby.isPending ? <p>Loading sessions…</p> : null}
          {nearby.isError ? (
            <p className="text-danger">
              {errorMessage(nearby.error)} Sign in to load nearby sessions.
            </p>
          ) : null}
          {nearby.isSuccess && groups.length === 0 ? <p className="text-text-muted">No sessions nearby. Try another filter.</p> : null}
          {groups.map(([band, rows]) => (
            <div key={band} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-text-muted">{BAND_LABELS[band]}</h3>
              <div className="grid gap-3">
                {rows.map((row) => (
                  <SessionCard key={row.id} session={row} />
                ))}
              </div>
            </div>
          ))}
        </section>
        <aside className="relative sticky top-20 hidden h-[480px] rounded-xl bg-ink-200 lg:block dark:bg-ink-800">
          <p className="p-3 text-xs text-text-muted">Map · hover a card; pins are nearby sessions</p>
          {(nearby.data?.data ?? []).map((row, index) => (
            <a
              key={row.id}
              href={`/sessions/${row.id}`}
              className="absolute rounded-full bg-primary px-2 py-1 text-[10px] text-primary-text"
              style={{ top: 48 + (index % 8) * 44, left: 24 + (index % 4) * 56 }}
            >
              {row.sport.name.slice(0, 1)}
            </a>
          ))}
        </aside>
      </div>
    </Chrome>
  );
}
