'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { asList, DataTable } from '@/components/data-table';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { inputClass } from '@/lib/format';

type VenueRow = {
  id: string;
  name: string;
  city: string;
  isVerified: boolean;
  contactPhone: string | null;
};

export default function VenuesPage() {
  const [q, setQ] = useState('');
  const venues = useQuery({
    queryKey: queryKeys.admin.venues(q),
    queryFn: () => api.admin.venues(q || undefined),
  });
  const rows = asList<VenueRow>(venues.data?.data);

  return (
    <Shell>
      <h1 className="text-xl font-bold">Venues</h1>
      <input className={`${inputClass} max-w-sm`} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4">
        <DataTable
          columns={['Name', 'City', 'Verified', 'Staff phone']}
          empty={venues.isPending ? 'Loading…' : 'No venues.'}
          rows={rows.map((row) => [
            <Link key={row.id} className="text-primary" href={`/venues/${row.id}`}>
              {row.name}
            </Link>,
            row.city,
            row.isVerified ? 'yes' : 'no',
            row.contactPhone ?? '—',
          ])}
        />
      </div>
    </Shell>
  );
}
