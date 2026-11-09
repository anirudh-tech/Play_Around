'use client';

import { queryKeys } from '@playaround/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { asList, DataTable } from '@/components/data-table';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { inputClass } from '@/lib/format';

type Sport = {
  id: number;
  slug: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  defaultPlayers: number;
  isActive: boolean;
};

export default function SportsPage() {
  const client = useQueryClient();
  const sports = useQuery({ queryKey: queryKeys.admin.sports, queryFn: () => api.admin.sports() });
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const create = useMutation({
    mutationFn: (reason: string) =>
      api.admin.createSport({
        reason,
        name,
        slug,
        iconKey: slug || 'sport',
        accentColor: '#14B8A6',
        minPlayers: 2,
        maxPlayers: 22,
        defaultPlayers: 4,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.admin.sports }),
  });
  const patch = useMutation({
    mutationFn: (input: { id: number; isActive: boolean; reason: string }) =>
      api.admin.patchSport(input.id, { isActive: input.isActive, reason: input.reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.admin.sports }),
  });
  const rows = asList<Sport>(sports.data?.data);

  return (
    <Shell>
      <h1 className="text-xl font-bold">Sports</h1>
      <div className="mt-4 max-w-md">
        <ReasonForm
          actionLabel="Create sport"
          extra={
            <>
              <input className={inputClass} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={inputClass} placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </>
          }
          onSubmit={(reason) => create.mutateAsync(reason)}
        />
      </div>
      <div className="mt-6">
        <DataTable
          columns={['Name', 'Players', 'Active', '']}
          empty={sports.isPending ? 'Loading…' : 'No sports.'}
          rows={rows.map((row) => [
            `${row.name} (${row.slug})`,
            `${row.minPlayers}–${row.maxPlayers} default ${row.defaultPlayers}`,
            row.isActive ? 'yes' : 'no',
            <ReasonForm
              key={row.id}
              actionLabel={row.isActive ? 'Deactivate' : 'Activate'}
              onSubmit={(reason) => patch.mutateAsync({ id: row.id, isActive: !row.isActive, reason })}
            />,
          ])}
        />
      </div>
    </Shell>
  );
}
