import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('+971');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);
    setError(null);
    try {
      await api.users.sendPhone({ phone });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function verify() {
    setPending(true);
    setError(null);
    try {
      await api.users.verifyPhone(code);
      router.replace('/(tabs)');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <Title>Add a phone</Title>
      <Muted>Creating sessions requires a verified mobile number (E.164, e.g. +9715…).</Muted>
      {error ? <Banner text={error} /> : null}
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {!sent ? <PrimaryButton title="Send code" onPress={() => void send()} pending={pending} /> : null}
      {sent ? (
        <>
          <Field label="SMS code" value={code} onChangeText={setCode} keyboardType="numeric" />
          <PrimaryButton title="Verify phone" onPress={() => void verify()} pending={pending} />
        </>
      ) : null}
      <Pressable className="mt-4" onPress={() => router.replace('/(tabs)')}>
        <Text className="text-center text-ink-500">Skip for now</Text>
      </Pressable>
    </Screen>
  );
}
