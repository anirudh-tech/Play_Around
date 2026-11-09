import { queryKeys } from '@playaround/api-client';
import { splitShares } from '@playaround/contracts';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage, shareLabel } from '@/lib/format';
import { useAuth } from '@/store/auth';

export default function CreateScreen() {
  const accessToken = useAuth((s) => s.accessToken);
  const sports = useQuery({ queryKey: queryKeys.sports, queryFn: () => api.catalog.sports() });
  const venues = useQuery({ queryKey: queryKeys.venues(), queryFn: () => api.catalog.venues(), enabled: Boolean(accessToken) });
  const [type, setType] = useState<'EXISTING_BOOKING' | 'LOOKING_FOR_PLAYERS'>('EXISTING_BOOKING');
  const [sportId, setSportId] = useState<number | null>(null);
  const sport = (sports.data?.data ?? []).find((item) => item.id === sportId);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [area, setArea] = useState('Dubai Marina');
  const [capacity, setCapacity] = useState('4');
  const [minPlayers, setMinPlayers] = useState('');
  const [costAed, setCostAed] = useState('100');
  const [hours, setHours] = useState('4');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cap = Number(capacity);
  const fils = Math.round(Number(costAed || '0') * 100);
  const preview = useMemo(() => {
    if (!Number.isInteger(fils) || fils <= 0 || !Number.isInteger(cap) || cap < 1) return [];
    return splitShares(fils, cap);
  }, [fils, cap]);

  async function submit() {
    if (!accessToken) {
      router.push('/(auth)/login');
      return;
    }
    if (!sportId) {
      setError('Pick a sport.');
      return;
    }
    if (!Number.isInteger(cap) || cap < 1) {
      setError('Capacity must be a whole number of at least 1.');
      return;
    }
    if (sport && (cap < sport.minPlayers || cap > sport.maxPlayers)) {
      setError(`Capacity for ${sport.name} must be between ${sport.minPlayers} and ${sport.maxPlayers}.`);
      return;
    }
    setPending(true);
    setError(null);
    const startsAt = new Date(Date.now() + Number(hours || '4') * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    try {
      const created =
        type === 'EXISTING_BOOKING'
          ? await api.sessions.create({
              type,
              sportId,
              venue: { venueId: venueId ?? venues.data?.data[0]?.id ?? '' },
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              capacity: cap,
              minPlayers: minPlayers ? Number(minPlayers) : undefined,
              organiserIsPlaying: true,
              totalCostFils: fils,
            })
          : await api.sessions.create({
              type,
              sportId,
              preferredArea: { label: area, latitude: 25.0772, longitude: 55.139, radiusKm: 3 },
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              capacity: cap,
              minPlayers: minPlayers ? Number(minPlayers) : undefined,
              organiserIsPlaying: true,
              estimatedTotalCostFils: fils,
            });
      router.push(`/session/${created.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <ScrollView>
        <Title>Create a session</Title>
        <Muted>Review the split before you publish. Minimum share is AED 10 when the session is paid.</Muted>
        {error ? <Banner text={error} /> : null}
        <View className="mt-4 flex-row gap-2">
          <TypeChip label="I have a booking" active={type === 'EXISTING_BOOKING'} onPress={() => setType('EXISTING_BOOKING')} />
          <TypeChip label="Looking for players" active={type === 'LOOKING_FOR_PLAYERS'} onPress={() => setType('LOOKING_FOR_PLAYERS')} />
        </View>
        <Text className="mt-4 text-xs font-semibold uppercase text-ink-500">Sport</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {(sports.data?.data ?? []).map((item) => (
            <TypeChip
              key={item.id}
              label={item.name}
              active={sportId === item.id}
              onPress={() => {
                setSportId(item.id);
                setCapacity(String(item.defaultPlayers));
              }}
            />
          ))}
        </View>
        {type === 'EXISTING_BOOKING' ? (
          <View className="mt-4">
            <Text className="text-xs font-semibold uppercase text-ink-500">Venue</Text>
            {(venues.data?.data ?? []).slice(0, 8).map((venue) => (
              <Pressable key={venue.id} onPress={() => setVenueId(venue.id)} className="mt-2 rounded-lg border border-ink-200 p-3">
                <Text className={venueId === venue.id ? 'font-semibold text-brand-600' : 'text-ink-800 dark:text-ink-100'}>
                  {venue.name}
                </Text>
                <Text className="text-xs text-ink-500">{venue.city}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Field label="Preferred area" value={area} onChangeText={setArea} autoCapitalize="sentences" />
        )}
        <Field label="Hours from now" value={hours} onChangeText={setHours} keyboardType="numeric" />
        <Field
          label={sport ? `Capacity (${sport.minPlayers}–${sport.maxPlayers})` : 'Capacity'}
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="numeric"
        />
        <Field label="Minimum players (optional)" value={minPlayers} onChangeText={setMinPlayers} keyboardType="numeric" />
        <Field label="Total cost (AED)" value={costAed} onChangeText={setCostAed} keyboardType="numeric" />
        <View className="mt-4 rounded-xl bg-white p-4 dark:bg-ink-900">
          <Text className="font-semibold text-ink-900 dark:text-ink-50">Live split</Text>
          {preview.length ? (
            preview.map((amount, index) => (
              <Text key={index} className="mt-1 text-sm text-ink-500">
                Player {index + 1}: {shareLabel(amount)}
              </Text>
            ))
          ) : (
            <Text className="mt-1 text-sm text-ink-500">
              {fils <= 0 ? 'Free session' : 'Enter a whole-number capacity of at least 1.'}
            </Text>
          )}
        </View>
        <PrimaryButton title="Publish" onPress={() => void submit()} pending={pending} />
      </ScrollView>
    </Screen>
  );
}

function TypeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-full px-3 py-2 ${active ? 'bg-brand-600' : 'bg-white dark:bg-ink-900'}`}>
      <Text className={active ? 'text-white' : 'text-ink-700 dark:text-ink-200'}>{label}</Text>
    </Pressable>
  );
}
