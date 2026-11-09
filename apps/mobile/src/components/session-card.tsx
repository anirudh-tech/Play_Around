import { BAND_LABELS } from '@playaround/api-client';
import type { NearbySession, SessionSummary } from '@playaround/contracts';
import { Pressable, Text, View } from 'react-native';
import { shareLabel, when } from '@/lib/format';

export function SessionCard({
  session,
  onPress,
}: {
  session: SessionSummary | NearbySession;
  onPress: () => void;
}) {
  const nearby = 'band' in session ? session : null;
  const pending = session.venueConfirmationStatus === 'PENDING';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-3 rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold" style={{ color: session.sport.accentColor }}>
          {session.sport.name}
        </Text>
        {nearby ? <Text className="text-xs text-ink-500">{BAND_LABELS[nearby.band] ?? nearby.band}</Text> : null}
      </View>
      <Text className="mt-1 text-lg font-semibold text-ink-900 dark:text-ink-50">
        {session.title ?? session.location.label}
      </Text>
      <Text className="mt-1 text-sm text-ink-500">{when(session.startsAt)}</Text>
      <Text className="mt-1 text-sm text-ink-500">
        {session.location.label} · {session.spotsLeft} spots · {shareLabel(session.price.perPlayerMax?.amountFils)}
      </Text>
      {pending ? (
        <View className="mt-2 self-start rounded-full bg-warning/20 px-2 py-1">
          <Text className="text-xs font-semibold text-ink-800">Venue being arranged</Text>
        </View>
      ) : null}
      <Text className="mt-2 text-xs text-ink-400">{session.paymentNote}</Text>
    </Pressable>
  );
}
