import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';

export default function VerifyScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await api.auth.verifyEmail({ code });
      router.replace('/(auth)/phone');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <Title>Verify email</Title>
      <Muted>
        We emailed a 6-digit code to the address you signed up with. Check spam if you do not see “Your PlayAround signup code”.
      </Muted>
      {error ? <Banner text={error} /> : null}
      {info ? <Banner text={info} tone="info" /> : null}
      <Field label="Code" value={code} onChangeText={setCode} keyboardType="numeric" />
      <PrimaryButton title="Verify" onPress={() => void submit()} pending={pending} />
      <PrimaryButton
        title="Resend code"
        onPress={() => {
          void api.auth.resendVerify().then(() => setInfo('Code sent.')).catch((err) => setError(errorMessage(err)));
        }}
      />
    </Screen>
  );
}
