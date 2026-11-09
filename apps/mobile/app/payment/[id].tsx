import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage, shareLabel } from '@/lib/format';
import { useAuth } from '@/store/auth';

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuth((s) => s.accessToken);
  const me = useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => api.users.me(signal), enabled: Boolean(accessToken) });
  const payment = useQuery({ queryKey: queryKeys.payment(id), queryFn: () => api.payments.get(id) });
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const data = payment.data?.data;
  const userId = me.data?.data.id;
  const isPayer = data?.payer.id === userId;
  const isPayee = data?.payee.id === userId;

  async function run(fn: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await fn();
      await payment.refetch();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!data) {
    return (
      <Screen>
        <Muted>{payment.isPending ? 'Loading…' : 'Payment not found.'}</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{data.status.replaceAll('_', ' ')}</Title>
      <Muted>
        {data.payer.displayName} → {data.payee.displayName} · {shareLabel(data.amountDue.amountFils)}
      </Muted>
      <Text className="mt-3 text-sm text-ink-500">Pay the organiser directly. PlayAround doesn't collect payments.</Text>
      {error ? <Banner text={error} /> : null}
      {isPayer && data.status === 'UNPAID' ? (
        <>
          <Field label="Reference (optional)" value={reference} onChangeText={setReference} />
          <PrimaryButton
            title="I've paid"
            pending={pending}
            onPress={() => void run(() => api.payments.report(id, { method: 'CASH', reference: reference || undefined }))}
          />
        </>
      ) : null}
      {isPayer && data.status === 'PAYMENT_REPORTED' ? (
        <PrimaryButton title="Retract report" pending={pending} onPress={() => void run(() => api.payments.retract(id))} />
      ) : null}
      {isPayee && (data.status === 'UNPAID' || data.status === 'PAYMENT_REPORTED') ? (
        <>
          <PrimaryButton title="Confirm received" pending={pending} onPress={() => void run(() => api.payments.confirm(id))} />
          <PrimaryButton title="Waive" pending={pending} onPress={() => void run(() => api.payments.waive(id, { note: 'Waived' }))} />
        </>
      ) : null}
      {isPayee && data.status === 'PAID' ? (
        <PrimaryButton
          title="Record refund"
          pending={pending}
          onPress={() => void run(() => api.payments.refund(id, { amountFils: data.amountPaid.amountFils }))}
        />
      ) : null}
      {(isPayer || isPayee) && data.status !== 'PAYMENT_DISPUTED' ? (
        <PrimaryButton
          title="Open dispute"
          pending={pending}
          onPress={() => void run(() => api.payments.dispute(id, { reason: 'AMOUNT_INCORRECT' }))}
        />
      ) : null}
    </Screen>
  );
}
