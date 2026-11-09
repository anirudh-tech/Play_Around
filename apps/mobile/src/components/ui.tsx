import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-ink-50 dark:bg-ink-950">
      <View className="flex-1 p-5">{children}</View>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text className="text-3xl font-bold text-ink-900 dark:text-ink-50">{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text className="mt-2 text-sm text-ink-500 dark:text-ink-300">{children}</Text>;
}

export function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View className="mt-4">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        className="h-12 rounded-lg border border-ink-200 bg-white px-3 text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  pending,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`mt-5 h-12 items-center justify-center rounded-lg bg-brand-600 ${disabled || pending ? 'opacity-50' : ''}`}
      onPress={onPress}
      disabled={disabled || pending}
    >
      {pending ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">{title}</Text>}
    </Pressable>
  );
}

export function Banner({ text, tone = 'error' }: { text: string; tone?: 'error' | 'info' }) {
  return (
    <View className={`mt-3 rounded-lg px-3 py-2 ${tone === 'error' ? 'bg-danger/15' : 'bg-brand-100'}`}>
      <Text className={tone === 'error' ? 'text-danger' : 'text-brand-800'}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="items-center justify-center py-16">
      <Text className="text-lg font-semibold text-ink-900 dark:text-ink-50">{title}</Text>
      <Text className="mt-1 text-center text-sm text-ink-500">{body}</Text>
    </View>
  );
}
