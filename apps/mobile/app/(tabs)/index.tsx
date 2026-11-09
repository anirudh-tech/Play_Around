import { BAND_LABELS, DEFAULT_MAP_CENTER, queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SessionCard } from '@/components/session-card';
import { EmptyState } from '@/components/ui';
import { api, sockets } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/store/auth';

export default function DiscoverScreen() {
  const accessToken = useAuth((s) => s.accessToken);
  const [lat] = useState(DEFAULT_MAP_CENTER.lat);
  const [lng] = useState(DEFAULT_MAP_CENTER.lng);
  const [sportId, setSportId] = useState<number | undefined>();
  const [joinableOnly, setJoinableOnly] = useState(false);
  const [mapView, setMapView] = useState(false);

  const sports = useQuery({ queryKey: queryKeys.sports, queryFn: () => api.catalog.sports() });
  const params = useMemo(
    () => ({
      lat,
      lng,
      autoExpand: true,
      joinableOnly,
      ...(sportId ? { sportIds: String(sportId) } : {}),
    }),
    [lat, lng, joinableOnly, sportId],
  );
  const nearby = useQuery({
    queryKey: queryKeys.nearby(params),
    queryFn: ({ signal }) => api.sessions.nearby(params, signal),
  });

  useEffect(() => {
    const ids = (nearby.data?.data ?? []).map((row) => row.id);
    if (ids.length) sockets.subscribe(ids);
  }, [nearby.data]);

  const groups = useMemo(() => {
    const rows = nearby.data?.data ?? [];
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = map.get(row.band) ?? [];
      list.push(row);
      map.set(row.band, list);
    }
    return [...map.entries()];
  }, [nearby.data]);

  return (
    <SafeAreaView className="flex-1 bg-ink-50 dark:bg-ink-950">
      <ScrollView className="flex-1" contentContainerClassName="p-5 pb-10">
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-bold text-ink-900 dark:text-ink-50">Discover</Text>
          {!accessToken ? (
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text className="font-semibold text-brand-600">Sign in</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="mt-1 text-sm text-ink-500">Near {DEFAULT_MAP_CENTER.label}</Text>

        <ScrollView horizontal className="mt-4" showsHorizontalScrollIndicator={false}>
          <Chip label="All sports" active={!sportId} onPress={() => setSportId(undefined)} />
          {(sports.data?.data ?? []).map((sport) => (
            <Chip key={sport.id} label={sport.name} active={sportId === sport.id} onPress={() => setSportId(sport.id)} />
          ))}
        </ScrollView>
        <View className="mt-3 flex-row gap-2">
          <Chip label={joinableOnly ? 'Joinable only' : 'Including pending venues'} active={joinableOnly} onPress={() => setJoinableOnly((v) => !v)} />
          <Chip label={mapView ? 'Map' : 'List'} active={mapView} onPress={() => setMapView((v) => !v)} />
        </View>

        {nearby.isPending ? <ActivityIndicator className="mt-12" /> : null}
        {nearby.isError ? <Text className="mt-8 text-danger">{errorMessage(nearby.error)}</Text> : null}
        {nearby.isSuccess && groups.length === 0 ? (
          <EmptyState title="No sessions nearby" body="Try another sport or turn off joinable-only." />
        ) : null}

        {mapView ? (
          <View className="mt-6 h-64 overflow-hidden rounded-xl bg-ink-200 dark:bg-ink-800">
            {(nearby.data?.data ?? []).map((row, index) => (
              <Pressable
                key={row.id}
                onPress={() => router.push(`/session/${row.id}`)}
                className="absolute rounded-full bg-brand-600 px-2 py-1"
                style={{ top: 20 + (index % 6) * 32, left: 16 + (index % 5) * 56 }}
              >
                <Text className="text-[10px] text-white">{row.sport.name[0]}</Text>
              </Pressable>
            ))}
            <Text className="absolute bottom-3 left-3 text-xs text-ink-600">Schematic map · pins are sessions</Text>
          </View>
        ) : (
          groups.map(([band, rows]) => (
            <View key={band} className="mt-6">
              <Text className="mb-2 text-sm font-semibold text-ink-500">{BAND_LABELS[band] ?? band}</Text>
              {rows.map((row) => (
                <SessionCard key={row.id} session={row} onPress={() => router.push(`/session/${row.id}`)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full px-3 py-2 ${active ? 'bg-brand-600' : 'bg-white dark:bg-ink-900'}`}
    >
      <Text className={active ? 'text-white' : 'text-ink-700 dark:text-ink-200'}>{label}</Text>
    </Pressable>
  );
}
