/**
 * Appens yttersta layout.
 *
 * En Stack som innehåller två delar:
 *   - (tabs): appens huvuddel med flikar
 *   - login:  inloggningsskärmen, utanför flikarna
 *
 * Tema och startskärm (splash) hanteras här, så att de gäller hela appen.
 */
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen
          name="rate/[songId]"
          options={{
            // Visas som iOS eget ark från botten istället för en hel skärm.
            presentation: 'formSheet',
            // Arket täcker halva skärmen, och kan dras upp till hel.
            sheetAllowedDetents: [0.5, 1.0],
            sheetGrabberVisible: true,
            // Genomskinlig bakgrund så att iOS glaseffekt syns.
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}