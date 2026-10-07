/**
 * rate/[songId].tsx
 *
 * Betygsrutan. Visas som ett ark (sheet) över halva skärmen och kan
 * öppnas från vilken skärm som helst:
 *
 *   router.push(`/rate/${dailySongId}`);
 *
 * songId är id:t för en rad i daily_songs, alltså en persons val av dagens
 * låt. Ett betyg gäller det valet, inte låten i sig.
 *
 * Användaren kan betygsätta låten från 1 till 5 i halva steg. Har hen redan
 * betygsatt låten visas det tidigare betyget, och ett nytt val ersätter det.
 *
 * Om användaren inte får betygsätta låten (sin egen låt, eller en låt från
 * någon som inte är vän eller gruppkompis) visas ett meddelande istället.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { StarRating } from '@/components/rating/star-rating';
import { ThemedText } from '@/components/themed-text';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type Song = {
  track_name: string;
  artist_name: string;
  image_url: string | null;
  owner: { display_name: string | null } | null;
};

export default function RateScreen() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const dailySongId = Number(songId);

  const [song, setSong] = useState<Song | null>(null);
  const [rating, setRating] = useState(0);
  const [canRate, setCanRate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSong();
  }, [dailySongId]);

  /**
   * Hämtar låten, användarens tidigare betyg och om användaren får
   * betygsätta låten. De tre frågorna är oberoende och körs parallellt.
   */
  async function loadSong() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('You need to be signed in to rate songs.');

      const [songResult, ratingResult, canRateResult] = await Promise.all([
        supabase
          .from('daily_songs')
          .select('track_name, artist_name, image_url, owner:profiles ( display_name )')
          .eq('id', dailySongId)
          .single(),
        supabase
          .from('song_ratings')
          .select('rating')
          .eq('daily_song_id', dailySongId)
          .eq('user_id', userData.user.id)
          .maybeSingle(),
        // Samma regel som databasen använder när betyget sparas.
        supabase.rpc('can_rate', { song: dailySongId }),
      ]);

      if (songResult.error) throw songResult.error;
      if (ratingResult.error) throw ratingResult.error;
      if (canRateResult.error) throw canRateResult.error;

      setSong(songResult.data);
      setRating(ratingResult.data?.rating ?? 0);
      setCanRate(canRateResult.data === true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sparar betyget. upsert skapar ett nytt betyg, eller ersätter det
   * tidigare om användaren redan har betygsatt låten.
   */
  async function handleSave() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase.from('song_ratings').upsert(
        { daily_song_id: dailySongId, user_id: userData.user.id, rating },
        { onConflict: 'daily_song_id,user_id' }
      );
      if (error) throw error;

      router.back();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {song && (
        <View style={styles.songRow}>
          {song.image_url && <Image source={{ uri: song.image_url }} style={styles.cover} />}
          <View style={styles.songText}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {song.track_name}
            </ThemedText>
            <ThemedText style={styles.dim} numberOfLines={1}>
              {song.artist_name}
            </ThemedText>
            {song.owner?.display_name && (
              <ThemedText style={styles.dim}>Picked by {song.owner.display_name}</ThemedText>
            )}
          </View>
        </View>
      )}

      {canRate ? (
        <>
          <StarRating value={rating} onChange={setRating} />
          <ThemedText style={styles.dim}>
            {rating > 0 ? `${rating} / 5` : 'Tap a star to rate'}
          </ThemedText>

          <Pressable
            style={[styles.button, (rating === 0 || saving) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={rating === 0 || saving}
          >
            <ThemedText style={styles.buttonText}>{saving ? 'Saving...' : 'Save rating'}</ThemedText>
          </Pressable>
        </>
      ) : (
        !errorMessage && (
          <ThemedText style={styles.dim}>
            You can only rate songs picked by your friends and group members.
          </ThemedText>
        )
      )}

      {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 20, alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch' },
  cover: { width: 64, height: 64, borderRadius: 6 },
  songText: { flex: 1, gap: 2 },
  dim: { opacity: 0.6 },
  button: { backgroundColor: '#1DB954', paddingVertical: 14, borderRadius: 999, alignSelf: 'stretch', alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c0392b', textAlign: 'center' },
});