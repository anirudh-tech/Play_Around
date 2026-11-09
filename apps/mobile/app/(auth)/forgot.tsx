import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Field, PrimaryButton, Screen, Title, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';

export default function ForgotScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Screen>
      <Title>Reset password</Title>
      <Muted>We’ll email a 6-digit code.</Muted>
      {error ? <Banner text={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      {!sent ? (
        <PrimaryButton
          title="Send code"
          pending={pending}
          onPress={() => {
            setPending(true);
            void api.auth
              .forgotPassword({ email })
              .then(() => setSent(true))
              .catch((err) => setError(errorMessage(err)))
              .finally(() => setPending(false));
          }}
        />
      ) : (
        <>
          <Field label="Code" value={code} onChangeText={setCode} keyboardType="numeric" />
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
          <PrimaryButton
            title="Reset"
            pending={pending}
            onPress={() => {
              setPending(true);
              void api.auth
                .resetPassword({ email, code, password })
                .then(() => router.replace('/(auth)/login'))
                .catch((err) => setError(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          />
        </>
      )}
    </Screen>
  );
}
