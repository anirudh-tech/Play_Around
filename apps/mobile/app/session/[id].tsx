import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api, sockets } from '@/lib/api';
import { errorMessage, shareLabel, when } from '@/lib/format';
import { useAuth } from '@/store/auth';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuth((s) => s.accessToken);
  useEffect(() => {
    if (!id) return;
    sockets.subscribe([id]);
    return () => sockets.unsubscribe([id]);
  }, [id]);
  const me = useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => api.users.me(signal), enabled: Boolean(accessToken) });
  const session = useQuery({ queryKey: queryKeys.session(id), queryFn: ({ signal }) => api.sessions.get(id, signal) });
  const participants = useQuery({
    queryKey: queryKeys.participants(id),
    queryFn: () => api.sessions.participants(id),
    enabled: Boolean(accessToken),
  });
  const payments = useQuery({
    queryKey: queryKeys.sessionPayments(id),
    queryFn: () => api.payments.forSession(id),
    enabled: Boolean(accessToken && me.data?.data.id && session.data?.data.organiser.id === me.data.data.id),
  });
  const arrangement = useQuery({
    queryKey: queryKeys.arrangement(id),
    queryFn: () => api.sessions.arrangement(id),
    enabled: Boolean(accessToken && session.data?.data.type === 'LOOKING_FOR_PLAYERS' && session.data.data.organiser.id === me.data?.data.id),
  });
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);

  const data = session.data?.data;
  const userId = me.data?.data.id;
  const isOrganiser = Boolean(userId && data && data.organiser.id === userId);
  const mine = participants.data?.data.find((row) => row.userId === userId);
  const pendingVenue = data?.venueConfirmationStatus === 'PENDING';

  async function run(fn: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await fn();
      await Promise.all([session.refetch(), participants.refetch(), payments.refetch()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (session.isPending) {
    return (
      <Screen>
        <Muted>Loading session…</Muted>
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Title>Session unavailable</Title>
        <Muted>{session.error ? errorMessage(session.error) : 'Not found.'}</Muted>
      </Screen>
    );
  }

  const options = ((arrangement.data?.data as { options?: Array<{ id: string; status: string; notes?: string }> } | undefined)?.options ?? []).filter(
    (row) => row.status === 'PROPOSED',
  );

  return (
    <Screen>
      <ScrollView>
        <Text className="text-xs font-semibold" style={{ color: data.sport.accentColor }}>
          {data.sport.name}
        </Text>
        <Title>{data.title ?? data.location.label}</Title>
        <Muted>{when(data.startsAt)} · {data.location.label}</Muted>
        <Text className="mt-2 text-sm text-ink-500">
          {data.confirmedCount}/{data.capacity} joined · {shareLabel(data.price.perPlayerMax?.amountFils)}
        </Text>
        {pendingVenue ? (
          <View className="mt-3 rounded-lg bg-warning/20 p-3">
            <Text className="font-semibold">Venue being arranged</Text>
            <Text className="text-sm text-ink-600">You can register interest. Joining opens after the venue is confirmed.</Text>
          </View>
        ) : null}
        <Text className="mt-3 text-sm text-ink-500">{data.paymentNote}</Text>
        {error ? <Banner text={error} /> : null}

        {!accessToken ? (
          <PrimaryButton title="Sign in to join" onPress={() => router.push('/(auth)/login')} />
        ) : pendingVenue && !isOrganiser ? (
          <PrimaryButton
            title="I'm interested"
            pending={pending}
            onPress={() => void run(() => api.sessions.interest(id, true))}
          />
        ) : mine && mine.status !== 'CANCELLED' ? (
          <PrimaryButton title="Leave session" pending={pending} onPress={() => void run(() => api.sessions.leave(id))} />
        ) : data.joinable ? (
          <PrimaryButton title="Join" pending={pending} onPress={() => void run(() => api.sessions.join(id))} />
        ) : null}

        <PrimaryButton
          title="Share link"
          onPress={() => void Share.share({ message: `PlayAround session: playaround://session/${id}` })}
        />

        {isOrganiser && data.minPlayers && data.confirmedCount < data.minPlayers ? (
          <View className="mt-4">
            <Text className="font-semibold">Minimum players</Text>
            <PrimaryButton title="Proceed anyway" pending={pending} onPress={() => void run(() => api.sessions.minPlayersDecision(id, { decision: 'PROCEED' }))} />
            <PrimaryButton title="Cancel session" pending={pending} onPress={() => void run(() => api.sessions.minPlayersDecision(id, { decision: 'CANCEL' }))} />
          </View>
        ) : null}

        {isOrganiser ? (
          <View className="mt-4">
            <Text className="font-semibold">Organiser tools</Text>
            <Field label="Cancel note" value={note} onChangeText={setNote} />
            <PrimaryButton title="Cancel session" pending={pending} onPress={() => void run(() => api.sessions.cancel(id, { note }))} />
            {options.map((option) => (
              <View key={option.id} className="mt-3 rounded-lg border border-ink-200 p-3">
                <Text>{option.notes ?? 'Venue option'}</Text>
                <Pressable onPress={() => void run(() => api.sessions.approveOption(id, option.id))}>
                  <Text className="mt-2 text-brand-600">Approve</Text>
                </Pressable>
                <Pressable onPress={() => void run(() => api.sessions.rejectOption(id, option.id))}>
                  <Text className="mt-1 text-danger">Reject</Text>
                </Pressable>
                <Pressable onPress={() => void run(() => api.sessions.recordBooking(id, { venueOptionId: option.id }))}>
                  <Text className="mt-1 text-ink-700">Record booking</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Text className="mt-6 font-semibold text-ink-900 dark:text-ink-50">Players</Text>
        {(participants.data?.data ?? []).map((row) => (
          <View key={row.userId} className="mt-2 flex-row justify-between">
            <Text className="text-ink-800 dark:text-ink-100">{row.displayName}</Text>
            <Text className="text-xs text-ink-500">{row.paymentStatus ?? row.status}</Text>
          </View>
        ))}

        {isOrganiser && payments.data ? (
          <View className="mt-6">
            <Text className="font-semibold">Payments</Text>
            {payments.data.data.payments.map((payment) => (
              <Pressable key={payment.id} className="mt-2 rounded-lg bg-white p-3" onPress={() => router.push(`/payment/${payment.id}`)}>
                <Text>{payment.payer.displayName}</Text>
                <Text className="text-sm text-ink-500">
                  {payment.status} · {shareLabel(payment.amountDue.amountFils)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!isOrganiser && mine ? (
          <PrimaryButton title="My payment" onPress={() => router.push('/(tabs)/activities')} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
