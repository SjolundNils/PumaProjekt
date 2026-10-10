/**
 * profile-view.tsx
 *
 * Visar en användares profil: profilbild, namn, biografi, dagens låt och
 * favoritalbum.
 *
 * Används av två sidor:
 *   - Profilfliken, för den inloggade användarens egen profil:
 *       <ProfileView userId={me} isOwn onEditPress={...} />
 *   - user/[userId], för andras profiler:
 *       <ProfileView userId={userId} />
 *
 * Skillnaden är att andras dagens låt kan betygsättas, och att den egna
 * profilen kan ha en redigeringsknapp.
 *
 * Profilen hämtas på nytt varje gång sidan visas, så att ändringar från
 * redigeringssidan syns direkt. Användaren kan också dra nedåt för att
 * uppdatera.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AlbumGrid } from '@/components/profile/album-grid';
import { RateButton } from '@/components/rating/rate-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getErrorMessage } from '@/lib/errors';
import { fetchProfile, type ProfileData } from '@/lib/profile';
import { fetchMyRatings } from '@/lib/ratings';
import { getRecentlyPlayed, getSpotifyProfile, RecentTrack, SpotifyProfileData } from '@/lib/spotifyData';

type Props = {
  /** Användaren vars profil visas. */
  userId: string;
  /** Sant om det är den inloggade användarens egen profil. */
  isOwn?: boolean;
  /** Visar en Edit profile-knapp som anropar funktionen när den trycks. */
  onEditPress?: () => void;
  /** Extra utrymme längst ner, till exempel för flikraden. */
  bottomInset?: number;
};

export function ProfileView({ userId, isOwn = false, onEditPress, bottomInset = 0 }: Props) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfileData | null>(null);
  const [myRating, setMyRating] = useState<number | undefined>(undefined);
  const [recentSongs, setRecentSongs] = useState<RecentTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Hämtar profilen. För andras profiler hämtas också användarens eget
   * betyg på dagens låt, så att stjärnorna kan visas.
   */
  const load = useCallback(async () => {
    try {
      const result = await fetchProfile(userId);
      setData(result);
      setErrorMessage(null);

      const spotifyData = await getSpotifyProfile();
      setSpotifyProfile({ display_name: spotifyData.display_name, image_url: spotifyData.image_url });

      setRecentSongs(await getRecentlyPlayed());

      if (!isOwn && result.todaysSong) {
        const ratings = await fetchMyRatings([result.todaysSong.id]);
        setMyRating(ratings[result.todaysSong.id]);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [userId, isOwn]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!data) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.error}>{errorMessage ?? 'Something went wrong.'}</ThemedText>
      </ThemedView>
    );
  }

  const { profile, albums, todaysSong } = data;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 + bottomInset }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          {spotifyProfile?.image_url ? (
            <Image source={{ uri: spotifyProfile?.image_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholder]} />
          )}
          <ThemedText type="title" style={styles.name}>
            {profile.display_name ?? 'Unknown'}
          </ThemedText>
          {profile.biography && <ThemedText style={styles.bio}>{profile.biography}</ThemedText>}

          {onEditPress && (
            <Pressable style={styles.editButton} onPress={onEditPress}>
              <ThemedText style={styles.editButtonText}>Edit profile</ThemedText>
            </Pressable>
          )}
        </View>

        {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

        <ThemedText type="subtitle">Today's song</ThemedText>
        {todaysSong ? (
          <Pressable
            style={styles.songRow}
            onPress={() =>
              Linking.openURL(`https://open.spotify.com/track/${todaysSong.spotify_track_id}`)
            }
          >
            {todaysSong.image_url && (
              <Image source={{ uri: todaysSong.image_url }} style={styles.songCover} />
            )}
            <View style={styles.songText}>
              <ThemedText style={styles.songName} numberOfLines={1}>
                {todaysSong.track_name}
              </ThemedText>
              <ThemedText style={styles.dim} numberOfLines={1}>
                {todaysSong.artist_name}
              </ThemedText>
              {!isOwn && <RateButton dailySongId={todaysSong.id} myRating={myRating} />}
            </View>
          </Pressable>
        ) : (
          <ThemedText style={styles.dim}>
            {isOwn ? "You haven't picked a song today." : 'No song picked today.'}
          </ThemedText>
        )}

        <ThemedText type="subtitle">Favorite albums</ThemedText>
        {albums.length === 0 && !isOwn ? (
          <ThemedText style={styles.dim}>No favorite albums yet.</ThemedText>
        ) : (
          <AlbumGrid albums={albums} />
        )}

        <ThemedText type="subtitle">Recent songs</ThemedText>
        {recentSongs.map((song) => (
          <View key={`${song.id}-${song.played_at}`} style={styles.songRow}>
            {song.image_url && (
              <Image source={{ uri: song.image_url }} style={styles.songCover} />
            )}
        
            <View>
              <ThemedText style={styles.songName}>{song.name}</ThemedText>
              <ThemedText style={styles.dim}>{song.artist_name}</ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16, gap: 16 },
  header: { alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  placeholder: { backgroundColor: 'rgba(128, 128, 128, 0.3)' },
  name: { textAlign: 'center' },
  bio: { textAlign: 'center', opacity: 0.8 },
  editButton: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.5)',
  },
  editButtonText: { fontWeight: '600' },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  songCover: { width: 64, height: 64, borderRadius: 6 },
  songText: { flex: 1, gap: 2 },
  songName: { fontWeight: '600' },
  dim: { opacity: 0.6 },
  error: { color: '#c0392b', textAlign: 'center' },
});