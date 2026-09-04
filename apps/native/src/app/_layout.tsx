import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider } from '@/features/auth/session-provider';
import { WatchRunInbox } from '@/features/run/components/watch-run-inbox';
import { palette } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <SessionProvider>
      <WatchRunInbox />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: palette.background },
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="run" options={{ title: 'Lauf' }} />
      </Stack>
    </SessionProvider>
  );
}
