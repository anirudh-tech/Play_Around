import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { EmptyState, PrimaryButton, Screen, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function NotificationsScreen() {
  const accessToken = useAuth((s) => s.accessToken);
  const list = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api.notifications.list(),
    enabled: Boolean(accessToken),
  });

  if (!accessToken) {
    return (
      <Screen>
        <Title>Alerts</Title>
        <Pressable className="mt-6" onPress={() => router.push('/(auth)/login')}>
          <Text className="text-brand-600">Sign in</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Alerts</Title>
      <PrimaryButton title="Mark all read" onPress={() => void api.notifications.readAll().then(() => list.refetch())} />
      <ScrollView className="mt-4">
        {(list.data?.data ?? []).length === 0 ? (
          <EmptyState title="You're up to date" body="Join and payment updates will land here." />
        ) : (
          (list.data?.data ?? []).map((item) => (
            <Pressable
              key={item.id}
              className="mb-2 rounded-xl border border-ink-200 bg-white p-4"
              onPress={() => {
                void api.notifications.read(item.id);
                if (item.sessionId) router.push(`/session/${item.sessionId}`);
              }}
            >
              <View className="flex-row justify-between">
                <Text className="font-semibold text-ink-900">{item.title}</Text>
                {item.readAt ? null : <View className="h-2 w-2 rounded-full bg-brand-600" />}
              </View>
              <Text className="mt-1 text-sm text-ink-500">{item.body}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
