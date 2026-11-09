'use client';

import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { asList, DataTable } from '@/components/data-table';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { inputClass } from '@/lib/format';

type UserRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  profile?: { displayName: string } | null;
};

export default function UsersPage() {
  const [q, setQ] = useState('');
  const users = useQuery({
    queryKey: queryKeys.admin.users(q),
    queryFn: () => api.admin.users({ q: q || undefined }),
  });
  const rows = asList<UserRow>(users.data?.data);

  return (
    <Shell>
      <h1 className="text-xl font-bold">Users</h1>
      <input className={`${inputClass} max-w-sm`} placeholder="Search email or name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4">
        <DataTable
          columns={['Name', 'Email', 'Role', 'Status', 'Verified']}
          empty={users.isPending ? 'Loading…' : 'No users.'}
          rows={rows.map((row) => [
            <Link key={row.id} className="text-primary" href={`/users/${row.id}`}>
              {row.profile?.displayName ?? '—'}
            </Link>,
            row.email,
            row.role,
            row.status,
            [row.emailVerifiedAt ? 'email' : null, row.phoneVerifiedAt ? 'phone' : null].filter(Boolean).join(', ') || 'no',
          ])}
        />
      </div>
    </Shell>
  );
}
