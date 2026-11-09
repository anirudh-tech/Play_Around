import '../global.css';

import { bindRealtimeCache } from '@playaround/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { sockets } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  const token = useAuth((s) => s.accessToken);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) {
      sockets.disconnect();
      return;
    }
    return bindRealtimeCache(queryClient, sockets);
  }, [queryClient, token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="session/[id]" options={{ headerShown: true, title: 'Session' }} />
          <Stack.Screen name="payment/[id]" options={{ headerShown: true, title: 'Payment' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
