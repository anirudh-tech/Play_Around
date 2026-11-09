import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, View, useColorScheme } from 'react-native';

// iOS uses a real blur; Android and web get a translucent solid fallback (architecture §7).
export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  const scheme = useColorScheme();
  const base = `overflow-hidden rounded-xl border p-6 ${className ?? ''}`;

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={40}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        className={`${base} border-white/40`}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View className={`${base} border-white/50 bg-white/80 dark:border-white/10 dark:bg-ink-900/85`}>
      {children}
    </View>
  );
}
