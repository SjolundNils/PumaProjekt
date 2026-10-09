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

import { ProfileView } from '@/components/profile/profile-view';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <ProfileView userId={userId} />;
}