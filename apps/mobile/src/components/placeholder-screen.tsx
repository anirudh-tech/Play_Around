import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PlaceholderScreen({ title, phase }: { title: string; phase: string }) {
  return (
    <SafeAreaView className="flex-1 bg-ink-50 dark:bg-ink-950">
      <View className="flex-1 items-center justify-center gap-2 p-6">
        <Text className="text-2xl font-bold text-ink-900 dark:text-ink-50">{title}</Text>
        <Text className="text-sm text-ink-500 dark:text-ink-300">Coming in {phase}</Text>
      </View>
    </SafeAreaView>
  );
}
