import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { api } from '@/lib/api';

export function ApiStatus() {
  const live = useQuery({
    queryKey: queryKeys.health.live,
    queryFn: ({ signal }) => api.health.live(signal),
    retry: false,
  });
  const ready = useQuery({
    queryKey: queryKeys.health.ready,
    queryFn: ({ signal }) => api.health.ready(signal),
    retry: false,
  });

  const rows = [
    {
      label: 'API',
      ok: live.isSuccess,
      pending: live.isPending,
      detail: live.data ? `v${live.data.data.version}` : 'unreachable',
    },
    {
      label: 'Database',
      ok: ready.data?.data.checks.database === 'up',
      pending: ready.isPending,
      detail: ready.data?.data.checks.database ?? 'unknown',
    },
  ];

  return (
    <View className="gap-2">
      {rows.map((row) => (
        <View key={row.label} className="flex-row items-center justify-between">
          <Text className="text-sm text-ink-500 dark:text-ink-300">{row.label}</Text>
          <View className="flex-row items-center gap-2">
            <View
              className={`h-2 w-2 rounded-full ${
                row.pending ? 'bg-ink-300' : row.ok ? 'bg-success' : 'bg-danger'
              }`}
            />
            <Text className="text-sm font-medium text-ink-900 dark:text-ink-50">
              {row.pending ? 'checking…' : row.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
