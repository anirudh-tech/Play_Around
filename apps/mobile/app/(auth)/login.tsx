import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/store/auth';

export default function LoginScreen() {
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await api.auth.login({ email, password });
      await setSession({
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user,
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <Title>Welcome back</Title>
      <Muted>Pay organisers directly. PlayAround never collects your money.</Muted>
      {error ? <Banner text={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <PrimaryButton title="Sign in" onPress={() => void submit()} pending={pending} />
      <Link href="/(auth)/register" asChild>
        <Pressable className="mt-4">
          <Text className="text-center text-brand-600">Create an account</Text>
        </Pressable>
      </Link>
      <Link href="/(auth)/forgot" asChild>
        <Pressable className="mt-3">
          <Text className="text-center text-ink-500">Forgot password</Text>
        </Pressable>
      </Link>
      <Muted>
        Google and Apple sign-in need OAuth client IDs, which are not configured in this local
        environment.
      </Muted>
    </Screen>
  );
}
