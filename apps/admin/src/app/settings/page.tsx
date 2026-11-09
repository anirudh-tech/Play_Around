'use client';

import { queryKeys } from '@playaround/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { inputClass } from '@/lib/format';

export default function SettingsPage() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: queryKeys.admin.settings, queryFn: () => api.admin.settings() });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const put = useMutation({
    mutationFn: (input: { key: string; value: number; reason: string }) =>
      api.admin.putSetting(input.key, { value: input.value, reason: input.reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.admin.settings }),
  });
  const data = (settings.data?.data ?? {}) as Record<string, number>;

  return (
    <Shell>
      <h1 className="text-xl font-bold">Platform settings</h1>
      {settings.isPending ? <p className="mt-3 text-sm">Loading…</p> : null}
      <ul className="mt-4 max-w-xl space-y-4">
        {Object.entries(data).map(([key, value]) => (
          <li key={key} className="rounded-md border border-border p-3">
            <p className="font-mono text-xs">{key}</p>
            <ReasonForm
              actionLabel="Save"
              extra={
                <input
                  className={inputClass}
                  type="number"
                  value={draft[key] ?? String(value)}
                  onChange={(e) => setDraft((current) => ({ ...current, [key]: e.target.value }))}
                />
              }
              onSubmit={(reason) =>
                put.mutateAsync({ key, value: Number(draft[key] ?? value), reason })
              }
            />
          </li>
        ))}
      </ul>
    </Shell>
  );
}
