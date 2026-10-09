/**
 * add-song.tsx
 *
 * Fliken för att välja dagens låt.
 *
 * Visar användarens senast spelade låtar och låter hen söka efter fler.
 * Alla Spotify-anrop går via servern (se spotifyData.ts och
 * spotifySearch.ts), så appen hanterar aldrig några Spotify-nycklar.
 *
 * När en låt har valts sparas den i daily_songs. Databasen sätter dagens
 * datum i svensk tid, och tillåter bara en låt per person och dag.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

import { getErrorMessage } from '@/lib/errors';
import { getRecentlyPlayed } from '@/lib/spotifyData';
import { searchTracks, SpotifyNotConnectedError } from '@/lib/spotifySearch';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const glassSupported = isLiquidGlassAvailable();
const SEARCH_BAR_HEIGHT = 48;

/**
 * En låt som kan väljas. Både senast spelade och sökresultat görs om till
 * den här formen, så att resten av sidan bara behöver hantera en typ.
 *
 * key är unik för varje rad i en lista. För senast spelade är det
 * tidpunkten då låten spelades, eftersom samma låt kan förekomma flera
 * gånger.
 */
type Song = {
  key: string;
  id: string;
  name: string;
  artist_name: string;
  image_url: string | null;
};

/** Gör om en låt från servern till sidans egen form. */
function toSong(track: { id: string; name: string; artist_name: string; image_url: string | null }, key?: string): Song {
  return {
    key: key ?? track.id,
    id: track.id,
    name: track.name,
    artist_name: track.artist_name,
    image_url: track.image_url,
  };
}

export default function AddSongScreen() {
  const [query, setQuery] = useState('');
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [tracks, setTracks] = useState<Song[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Song | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  

  /**
   * Visar ett begripligt fel. Om Spotify-kopplingen har gått ut skickas
   * användaren till inloggningen.
   */
  function handleSpotifyError(error: unknown) {
    if (error instanceof SpotifyNotConnectedError) {
      router.replace('/login');
      return;
    }
    setErrorMessage(getErrorMessage(error));
  }

  async function loadRecentSongs() {
    setLoadingRecent(true);
    try {
      const recent = await getRecentlyPlayed();
      setRecentSongs(recent.map((track) => toSong(track, track.played_at)));
    } catch (error) {
      handleSpotifyError(error);
    } finally {
      setLoadingRecent(false);
    }
  }

  useEffect(() => {
    loadRecentSongs();
  }, []);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      const results = await searchTracks(trimmed);
      setTracks(results.map((track) => toSong(track)));
    } catch (error) {
      handleSpotifyError(error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sparar den valda låten som dagens låt.
   */
  async function confirmSelection() {
    if (!selectedTrack || saving) return;

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('You need to be signed in to pick a song.');

      // song_date utelämnas: databasen sätter dagens datum i svensk tid.
      const { error } = await supabase.from('daily_songs').insert({
        user_id: userId,
        spotify_track_id: selectedTrack.id,
        track_name: selectedTrack.name,
        artist_name: selectedTrack.artist_name,
        image_url: selectedTrack.image_url,
      });

      // 23505 = unik regel bruten: användaren har redan valt en låt idag.
      if (error?.code === '23505') {
        throw new Error("You've already picked today's song.");
      }
      if (error) throw error;

      setSelectedTrack(null);
      Alert.alert('Done', `${selectedTrack.name} is your song of the day.`, [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (error) {
      Alert.alert('Could not save the song', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function renderTrack(track: Song, compact = false) {
    const selected = selectedTrack?.key === track.key;

    return (
      <Pressable
        style={[
          compact ? styles.recentItem : styles.row,
          selected && [styles.selected, { backgroundColor: theme.backgroundSelected, borderColor: theme.text }],
        ]}
        onPress={() => setSelectedTrack(track)}
        accessibilityRole="button"
        accessibilityLabel={`Pick ${track.name}`}
      >
        {track.image_url && (
          <Image source={{ uri: track.image_url }} style={compact ? styles.recentCover : styles.cover} />
        )}
        <View style={compact ? styles.recentText : styles.rowText}>
          <ThemedText style={styles.trackName} numberOfLines={1}>{track.name}</ThemedText>
          <ThemedText style={styles.artist} numberOfLines={1}>{track.artist_name}</ThemedText>
        </View>
        {selected && <Ionicons name="checkmark-circle" size={22} color={theme.text} />}
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>Add Track</ThemedText>
        <ThemedText type="small" style={styles.subtitle}>
          This will be your track for all groups today, so choose wisely. Or don't.
        </ThemedText>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            data={tracks}
            keyExtractor={(track) => track.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 96 + insets.bottom }}
            ListHeaderComponent={
              <>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Recent tracks</ThemedText>
                {loadingRecent ? (
                  <ActivityIndicator style={styles.recentLoading} />
                ) : (
                  <FlatList
                    horizontal
                    data={recentSongs}
                    keyExtractor={(track) => `recent-${track.key}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentList}
                    renderItem={({ item }) => renderTrack(item, true)}
                    ListEmptyComponent={
                      <ThemedText style={styles.muted}>No recent tracks found.</ThemedText>
                    }
                  />
                )}
                <ThemedText type="subtitle" style={styles.sectionTitle}>Search results</ThemedText>
                {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}
              </>
            }
            renderItem={({ item }) => renderTrack(item)}
            ListEmptyComponent={
              !loading ? (
                <ThemedText style={styles.muted}>Search for a song to see results.</ThemedText>
              ) : null
            }
          />

          <View style={[styles.searchOverlay, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
            <GlassContainer spacing={8} style={styles.searchRow}>
              <GlassView style={[styles.searchField, !glassSupported && styles.fallback]} glassEffectStyle="regular">
                <Ionicons name="search" size={18} color={theme.text} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={handleSearch}
                  placeholder="Search for a song"
                  placeholderTextColor="#888"
                  returnKeyType="search"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </GlassView>
              <GlassView style={[styles.searchButton, !glassSupported && styles.fallback]} glassEffectStyle="regular" isInteractive>
                <Pressable onPress={handleSearch} disabled={loading} style={styles.searchButtonInner}>
                  {loading ? <ActivityIndicator /> : <Ionicons name="arrow-forward" size={20} color={theme.text} />}
                </Pressable>
              </GlassView>
            </GlassContainer>
            <Pressable
              style={[
                styles.confirmButton,
                { backgroundColor: theme.backgroundElement, borderColor: theme.text },
                !selectedTrack && styles.buttonDisabled,
              ]}
              onPress={confirmSelection}
              disabled={!selectedTrack || saving}
            >
              {saving ? <ActivityIndicator /> : <ThemedText style={styles.confirmText}>Confirm song</ThemedText>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  title: { paddingHorizontal: 16 },
  subtitle: { paddingHorizontal: 16, marginTop: 4 },
  sectionTitle: { marginTop: 20, marginBottom: 10 },
  recentList: { gap: 10 },
  recentItem: { width: 120, padding: 8, borderRadius: 10 },
  recentCover: { width: 104, height: 104, borderRadius: 8, marginBottom: 6 },
  recentText: { width: 104 },
  recentLoading: { marginVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderRadius: 8 },
  selected: { borderWidth: 2, borderRadius: 8 },
  cover: { width: 52, height: 52, borderRadius: 4 },
  rowText: { flex: 1 },
  trackName: { fontSize: 15, fontWeight: '600' },
  artist: { fontSize: 13, marginTop: 2 },
  muted: { paddingVertical: 12 },
  error: { marginBottom: 8, color: '#c0392b' },
  searchOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: SEARCH_BAR_HEIGHT, borderRadius: 24, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 17, paddingVertical: 0 },
  searchButton: { width: SEARCH_BAR_HEIGHT, height: SEARCH_BAR_HEIGHT, borderRadius: 24 },
  searchButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallback: { borderWidth: StyleSheet.hairlineWidth },
  confirmButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.45 },
  confirmText: { fontWeight: '700', fontSize: 16 },
});