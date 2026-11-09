import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { SessionCard } from '@/components/session-card';
import { EmptyState, Screen, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

const roles = ['joined', 'organised', 'interested'] as const;
const buckets = ['upcoming', 'completed', 'cancelled'] as const;

export default function ActivitiesScreen() {
  const accessToken = useAuth((s) => s.accessToken);
  const [role, setRole] = useState<(typeof roles)[number]>('joined');
  const [bucket, setBucket] = useState<(typeof buckets)[number]>('upcoming');
  const list = useQuery({
    queryKey: queryKeys.mySessions(role, bucket),
    queryFn: () => api.sessions.mine(role, bucket),
    enabled: Boolean(accessToken),
  });

  if (!accessToken) {
    return (
      <Screen>
        <Title>Activities</Title>
        <Pressable className="mt-6" onPress={() => router.push('/(auth)/login')}>
          <Text className="text-brand-600">Sign in to see your sessions</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Activities</Title>
      <ScrollView horizontal className="mt-4" showsHorizontalScrollIndicator={false}>
        {roles.map((item) => (
          <Pressable key={item} onPress={() => setRole(item)} className={`mr-2 rounded-full px-3 py-2 ${role === item ? 'bg-brand-600' : 'bg-white'}`}>
            <Text className={role === item ? 'text-white' : 'text-ink-700'}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal className="mt-2" showsHorizontalScrollIndicator={false}>
        {buckets.map((item) => (
          <Pressable key={item} onPress={() => setBucket(item)} className={`mr-2 rounded-full px-3 py-2 ${bucket === item ? 'bg-ink-900' : 'bg-white'}`}>
            <Text className={bucket === item ? 'text-white' : 'text-ink-700'}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView className="mt-4">
        {list.data?.data.length ? (
          list.data.data.map((session) => (
            <SessionCard key={session.id} session={session} onPress={() => router.push(`/session/${session.id}`)} />
          ))
        ) : (
          <EmptyState title="Nothing here" body="Join or create a session to fill this list." />
        )}
      </ScrollView>
    </Screen>
  );
}
