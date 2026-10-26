/**
 * user/[userId].tsx
 *
 * Visar en annan användares profil. Kan öppnas från vilken skärm som helst:
 *
 *   router.push({ pathname: '/user/[userId]', params: { userId } });
 *
 * Själva profilen visas av ProfileView (se components/profile/profile-view.tsx).
 */

import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile/profile-view';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <ProfileView userId={userId} topInset={Spacing.six} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { flex: 1 },
});