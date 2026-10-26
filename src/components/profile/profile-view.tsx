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
import { Radius, Spacing } from '@/constants/theme';
import { useScrollToTopOnTabPress } from '@/hooks/use-scroll-to-top-on-tab-press';
import { useTheme } from '@/hooks/use-theme';
import { signOut } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { fetchProfile, type ProfileData } from '@/lib/profile';
import { fetchMyRatings } from '@/lib/ratings';
import { getRecentlyPlayed, RecentTrack } from '@/lib/spotifyData';
import { spotifyTrackUrl } from '@/lib/spotifyLinks';
import { createTextStyles } from '@/styles/text';

type Props = {
  /** Användaren vars profil visas. */
  userId: string;
  /** Sant om det är den inloggade användarens egen profil. */
  isOwn?: boolean;
  /** Visar en Edit profile-knapp som anropar funktionen när den trycks. */
  onEditPress?: () => void;
  /** Extra utrymme längst ner, till exempel för flikraden. */
  bottomInset?: number;
  /** Extra utrymme ovanför scrollinnehållet. */
  topInset?: number;
};

export function ProfileView({
  userId,
  isOwn = false,
  onEditPress,
  bottomInset = 0,
  topInset = 0,
}: Props) {
  const theme = useTheme();
  const textStyles = createTextStyles(theme);
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
        <ThemedText style={[styles.error, { color: theme.destructiveText }]}>
          {errorMessage ?? 'Something went wrong.'}
        </ThemedText>
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
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Spacing.five + bottomInset,
            paddingTop: Spacing.three + topInset,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View
              style={[styles.avatar, styles.placeholder, { backgroundColor: theme.backgroundElement }]}
            />
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

        {errorMessage && (
          <ThemedText style={[styles.error, { color: theme.destructiveText }]}>
            {errorMessage}
          </ThemedText>
        )}

        <ThemedText style={textStyles.sectionTitle}>Today's track</ThemedText>
        {todaysSong ? (
          <View style={[styles.songRow, { backgroundColor: theme.backgroundElement }]}>
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
            {isOwn ? "You haven't picked a track today." : 'No track picked today.'}
          </ThemedText>
        )}

        <ThemedText style={textStyles.sectionTitle}>Favorite albums</ThemedText>
        {albums.length === 0 && !isOwn ? (
          <ThemedText style={styles.dim}>No favorite albums yet.</ThemedText>
        ) : (
          <AlbumGrid albums={albums} />
        )}

        {isOwn && recentSongs.length > 0 && (
          <ThemedText style={textStyles.sectionTitle}>Recent tracks</ThemedText>
        )}
        {isOwn && recentSongs.map((song) => (
          <View
            key={`${song.id}-${song.played_at}`}
            style={[styles.songRow, { backgroundColor: theme.backgroundElement }]}
          >
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
            <ThemedText style={[styles.logoutText, { color: theme.textSecondary }]}>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  placeholder: {},
  profileActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  nameBox: { flex: 1, minWidth: 0 },
  name: {},
  bio: { opacity: 0.8 },
  editButton: { alignSelf: 'flex-start', marginTop: Spacing.one },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two, borderRadius: Radius.medium },
  songCover: { width: 64, height: 64 },
  songText: { flex: 1, gap: Spacing.half },
  songLink: { alignSelf: 'flex-end' },
  songName: { fontWeight: '600' },
  dim: { opacity: 0.6 },
  error: { textAlign: 'center' },
  logoutButton: {
    alignSelf: 'center',
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
    paddingVertical: Spacing.two,
  },
  logoutText: {
    fontSize: 13,
    opacity: 0.7,
  },
});