/**
 * Appens yttersta layout.
 *
 * En Stack som innehåller två delar:
 *   - (tabs): appens huvuddel med flikar
 *   - login:  inloggningsskärmen, utanför flikarna
 *
 * Tema och startskärm (splash) hanteras här, så att de gäller hela appen.
 *
 * Layouten fungerar också som vakt för hela appen: bara användare med både
 * Supabase-session och fungerande Spotify-koppling (se lib/session.ts) släpps
 * in. Alla andra skickas till /login, och inloggade användare som hamnar på
 * /login skickas vidare till startsidan.
 */
import {
	DarkTheme,
	DefaultTheme,
	router,
	Stack,
	ThemeProvider,
	useRootNavigationState,
	useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { onSessionStatusChange, refreshSessionStatus, SessionStatus } from '@/lib/session';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [status, setStatus] = useState<SessionStatus | 'loading'>('loading');
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const navigationReady = Boolean(navigationState?.key);
  const firstSegment = segments[0] as string | undefined;

  // Kontrollerar inloggningsläget vid start och lyssnar på ändringar.
  useEffect(() => {
    const unsubscribe = onSessionStatusChange(setStatus);
    refreshSessionStatus();

    // Utloggning (från vilken skärm som helst) skickar användaren till /login.
    // SIGNED_IN ignoreras med flit: den utlöses mitt i inloggningen, innan
    // Spotify-nyckeln är sparad. Inloggningsskärmen anropar refreshSessionStatus
    // när allt är klart. Anropa inga supabase-funktioner inuti den här callbacken.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setStatus('signed_out');
    });

    return () => {
      unsubscribe();
      data.subscription.unsubscribe();
    };
  }, []);

  // Själva vakten.
  useEffect(() => {
    if (!navigationReady || status === 'loading') return;

    const onLogin = firstSegment === 'login';
    if (status !== 'ready' && !onLogin) {
      router.replace('/login');
    } else if (status === 'ready' && onLogin) {
      router.replace('/');
    }
  }, [status, firstSegment, navigationReady]);

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

      {/* Döljer appen tills läget är kontrollerat, så att inget flimrar förbi. */}
      {status === 'loading' && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.loading,
            { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
          ]}
        >
          <ActivityIndicator />
        </View>
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
});