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

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AlbumGrid } from '@/components/profile/album-grid';
import { FriendStatus } from '@/components/profile/friend-status';
import { RateButton } from '@/components/rating/rate-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { SpotifyButton } from '@/components/ui/spotify-button';
import { useScrollToTopOnTabPress } from '@/hooks/use-scroll-to-top-on-tab-press';
import { signOut } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { fetchProfile, type ProfileData } from '@/lib/profile';
import { fetchMyRatings } from '@/lib/ratings';
import { getRecentlyPlayed, RecentTrack } from '@/lib/spotifyData';
import { spotifyTrackUrl } from '@/lib/spotifyLinks';

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

  const [myRating, setMyRating] = useState<number | undefined>(undefined);
  const [recentSongs, setRecentSongs] = useState<RecentTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // På profilfliken scrollar ett tryck på fliken i flikraden upp till
  // toppen. På andras profiler finns ingen flik, så där händer inget.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useScrollToTopOnTabPress(scrollRef);

  /**
   * Hämtar profilen. För andras profiler hämtas också användarens eget
   * betyg på dagens låt, så att stjärnorna kan visas.
   */
  const load = useCallback(async () => {
    try {
      const result = await fetchProfile(userId);
      setData(result);
      setErrorMessage(null);

      if (isOwn) {
        try {
          setRecentSongs(await getRecentlyPlayed());
        } catch (spotifyError) {
          console.log('Kunde inte hämta senast spelade:', spotifyError);
        }
      }
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

  function confirmSignOut() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
      	text: 'Log out',
      	style: 'destructive',
      	onPress: async () => {
          try {
            await signOut();
            // _layout.tsx hanterar omdirigeringen till /login.
          } catch (error) {
          	Alert.alert(
              'Could not log out',
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: 32 + bottomInset }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholder]} />
          )}
          <View style={styles.profileActions}>
            <View style={styles.nameBox}>
              <ThemedText type="subtitle" style={styles.name} numberOfLines={1}>
                {profile.display_name ?? 'Unknown'}
              </ThemedText>
            </View>

            {isOwn ? (
              <ActionButton
                label="Friends"
                size="medium"
                color="base"
                onPress={() => router.push('/friends')}
              />
            ) : (
              <FriendStatus userId={userId} />
            )}

          </View>
          {profile.biography && <ThemedText style={styles.bio}>{profile.biography}</ThemedText>}

          {onEditPress && (
            <ActionButton
              label="Edit profile"
              onPress={onEditPress}
              size="medium"
              color="indigo"
              style={styles.editButton}
            />
          )}
        </View>

        {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

        <ThemedText type="default">Today's song</ThemedText>
        {todaysSong ? (
          <View style={styles.songRow}>
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
            <SpotifyButton
              url={spotifyTrackUrl(todaysSong.spotify_track_id)}
              style={styles.songLink}
            />
          </View>
        ) : (
          <ThemedText style={styles.dim}>
            {isOwn ? "You haven't picked a song today." : 'No song picked today.'}
          </ThemedText>
        )}

        <ThemedText type="default">Favorite albums</ThemedText>
        {albums.length === 0 && !isOwn ? (
          <ThemedText style={styles.dim}>No favorite albums yet.</ThemedText>
        ) : (
          <AlbumGrid albums={albums} />
        )}

        {isOwn && recentSongs.length > 0 && (
          <ThemedText type="default">Recent songs</ThemedText>
        )}
        {isOwn && recentSongs.map((song) => (
          <View key={`${song.id}-${song.played_at}`} style={styles.songRow}>
            {song.image_url && (
              <Image source={{ uri: song.image_url }} style={styles.songCover} />
            )}

            <View style={styles.songText}>
              <ThemedText style={styles.songName} numberOfLines={1}>
                {song.name}
              </ThemedText>
              <ThemedText style={styles.dim} numberOfLines={1}>
                {song.artist_name}
              </ThemedText>
            </View>
          </View>
        ))}

		{isOwn && (
    	  <Pressable
    		style={styles.logoutButton}
    		onPress={confirmSignOut}
  		  >
    		<ThemedText style={styles.logoutText}>
      		  Log out
    		</ThemedText>
  		  </Pressable>
		)}

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16, gap: 16 },
  header: { gap: 8, marginBottom: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  placeholder: { backgroundColor: 'rgba(128, 128, 128, 0.3)' },
  profileActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameBox: { width: '50%', maxWidth: '50%' },
  name: {},
  bio: { opacity: 0.8 },
  editButton: { alignSelf: 'flex-start', marginTop: 4 },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(128, 128, 128, 0.3)', padding: 8, borderRadius: 6 },
  songCover: { width: 64, height: 64 },
  songText: { flex: 1, gap: 2 },
  songLink: { alignSelf: 'flex-end' },
  songName: { fontWeight: '600' },
  dim: { opacity: 0.6 },
  error: { color: '#c0392b', textAlign: 'center' },
  logoutButton: {
    alignSelf: 'center',
    marginTop: 32,
    marginBottom: 16,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 13,
    color: '#888888',
    opacity: 0.7,
  },
});