'use client';

import { queryKeys } from '@playaround/api-client';
import { formatAed } from '@playaround/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Payment = {
  id: string;
  status: string;
  version: number;
  amountDue?: { amountFils: number };
  agreedAmount?: { amountFils: number };
  amountPaid?: { amountFils: number };
  refundedAmount?: { amountFils: number };
  session?: { title: string };
  payer?: { displayName: string };
  payee?: { displayName: string };
  log?: unknown[];
};

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuth((s) => s.user?.role);
  const client = useQueryClient();
  const payment = useQuery({ queryKey: queryKeys.admin.payment(id), queryFn: () => api.admin.payment(id) });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.admin.payment(id) });
  const confirm = useMutation({
    mutationFn: (reason: string) => api.admin.confirmPayment(id, { reason }),
    onSuccess: invalidate,
  });
  const waive = useMutation({
    mutationFn: (reason: string) => api.admin.waivePayment(id, { reason }),
    onSuccess: invalidate,
  });
  const refund = useMutation({
    mutationFn: (reason: string) => api.admin.refundPayment(id, { reason, amountFils: data?.amountPaid?.amountFils ?? 0 }),
    onSuccess: invalidate,
  });
  const data = payment.data?.data as Payment | undefined;
  const canMutate = role === 'SUPPORT' || role === 'SUPER_ADMIN';

  return (
    <Shell>
      {payment.isPending ? <p>Loading…</p> : null}
      {data ? (
        <>
          <h1 className="text-xl font-bold">{data.session?.title ?? 'Payment'}</h1>
          <p className="text-sm text-text-muted">
            {data.payer?.displayName} → {data.payee?.displayName} · {data.status}
          </p>
          <p className="mt-2 text-sm">
            Due {data.amountDue ? formatAed(data.amountDue.amountFils) : '—'} · Paid{' '}
            {data.amountPaid ? formatAed(data.amountPaid.amountFils) : '—'} · Refunded{' '}
            {data.refundedAmount ? formatAed(data.refundedAmount.amountFils) : '—'}
          </p>
          <p className="mt-2 text-xs text-text-muted">{(data.log ?? []).length} action log entries</p>
          {canMutate ? (
            <div className="mt-6 grid max-w-xl gap-3">
              <ReasonForm actionLabel="Confirm received" onSubmit={(reason) => confirm.mutateAsync(reason)} />
              <ReasonForm actionLabel="Waive" onSubmit={(reason) => waive.mutateAsync(reason)} />
              <ReasonForm actionLabel="Record refund of paid amount" onSubmit={(reason) => refund.mutateAsync(reason)} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-text-muted">Only support and super admins can change payment records.</p>
          )}
        </>
      ) : null}
    </Shell>
  );
}
