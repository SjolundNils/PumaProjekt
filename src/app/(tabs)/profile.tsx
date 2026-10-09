/**
 * profile.tsx
 *
 * Profilfliken. Visar den inloggade användarens egen profil, med en knapp
 * för att redigera den.
 *
 * Själva profilen visas av ProfileView (se components/profile/profile-view.tsx).
 */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile/profile-view';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);

  // Hämtar den inloggade användarens id från sessionen på telefonen.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  if (!userId) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ProfileView
          userId={userId}
          isOwn
          // TILLFÄLLIGT: pekar på testsidan tills edit-profile finns.
          onEditPress={() => router.push('/edit-profile')}
          bottomInset={BottomTabInset}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});