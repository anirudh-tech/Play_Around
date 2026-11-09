import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/store/auth';

export default function RegisterScreen() {
  const setSession = useAuth((s) => s.setSession);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await api.auth.register({ email, password, displayName });
      await setSession({
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user,
      });
      router.replace('/(auth)/verify');
    } catch (err) {
      inFlight.current = false;
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <Title>Join PlayAround</Title>
      <Muted>Find badminton, football and cricket sessions across the UAE.</Muted>
      {error ? <Banner text={error} /> : null}
      <Field label="Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="sentences" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 10 characters" />
      <PrimaryButton title="Create account" onPress={() => void submit()} pending={pending} />
      <Link href="/(auth)/login" asChild>
        <Pressable className="mt-4">
          <Text className="text-center text-brand-600">I already have an account</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}
