'use client';

import { queryKeys } from '@playaround/api-client';
import { formatAed } from '@playaround/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { asList, DataTable } from '@/components/data-table';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';

type Payment = {
  id: string;
  status: string;
  amountDue?: { amountFils: number };
  session?: { title: string };
  payer?: { displayName: string };
};

export default function PaymentsPage() {
  const list = useQuery({ queryKey: queryKeys.admin.payments(), queryFn: () => api.admin.payments() });
  const rows = asList<Payment>(list.data?.data);

  return (
    <Shell>
      <h1 className="text-xl font-bold">Payment records</h1>
      <div className="mt-4">
        <DataTable
          columns={['Session', 'Payer', 'Status', 'Due']}
          empty={list.isPending ? 'Loading…' : 'No payment records.'}
          rows={rows.map((row) => [
            <Link key={row.id} className="text-primary" href={`/payments/${row.id}`}>
              {row.session?.title ?? row.id}
            </Link>,
            row.payer?.displayName ?? '—',
            row.status,
            row.amountDue ? formatAed(row.amountDue.amountFils) : '—',
          ])}
        />
      </div>
    </Shell>
  );
}
