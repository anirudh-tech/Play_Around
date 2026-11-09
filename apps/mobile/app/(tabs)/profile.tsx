import { queryKeys } from '@playaround/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/store/auth';

export default function ProfileScreen() {
  const accessToken = useAuth((s) => s.accessToken);
  const setSession = useAuth((s) => s.setSession);
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.users.me(signal),
    enabled: Boolean(accessToken),
  });
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!accessToken) {
    return (
      <Screen>
        <Title>Profile</Title>
        <PrimaryButton title="Sign in" onPress={() => router.push('/(auth)/login')} />
      </Screen>
    );
  }

  const user = me.data?.data;
  return (
    <Screen>
      <Title>{user?.profile.displayName ?? 'Profile'}</Title>
      <Muted>{user?.email}</Muted>
      <Text className="mt-2 text-sm text-ink-500">
        Email {user?.emailVerifiedAt ? 'verified' : 'unverified'} · Phone{' '}
        {user?.phoneVerifiedAt ? 'verified' : 'not verified'}
      </Text>
      {error ? <Banner text={error} /> : null}
      <Field label="Display name" value={name || user?.profile.displayName || ''} onChangeText={setName} autoCapitalize="sentences" />
      <Field label="Bio" value={bio || user?.profile.bio || ''} onChangeText={setBio} autoCapitalize="sentences" />
      <PrimaryButton
        title="Save"
        onPress={() => {
          void api.users
            .patchMe({ displayName: name || user?.profile.displayName, bio: bio || user?.profile.bio })
            .then(() => me.refetch())
            .catch((err) => setError(errorMessage(err)));
        }}
      />
      {!user?.emailVerifiedAt ? (
        <PrimaryButton title="Verify email" onPress={() => router.push('/(auth)/verify')} />
      ) : null}
      <PrimaryButton title="Add phone" onPress={() => router.push('/(auth)/phone')} />
      <PrimaryButton
        title="Sign out"
        onPress={() => {
          void api.auth.logout().finally(() => {
            void setSession(null);
            router.replace('/(tabs)');
          });
        }}
      />
    </Screen>
  );
}
