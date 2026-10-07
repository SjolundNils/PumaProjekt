import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { getSpotifyTestToken } from '@/lib/spotifyTestToken';
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

type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string; width?: number }[] };
};

export default function AddSongScreen() {
  const [query, setQuery] = useState('');
  const [recentSongs, setRecentSongs] = useState<SpotifyTrack[]>([]);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  async function loadRecentSongs() {
    setLoadingRecent(true);
    try {
      const token = await getSpotifyTestToken();
      if (!token) {
        setErrorMessage('Ingen Spotify-nyckel hittades. Logga in igen.');
        return;
      }

      const response = await fetch(
        'https://api.spotify.com/v1/me/player/recently-played?limit=5',
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.status === 401) {
        setErrorMessage('Spotify-nyckeln har gått ut. Logga in igen.');
        return;
      }
      if (!response.ok) {
        setErrorMessage(`Spotify svarade med fel ${response.status}.`);
        return;
      }

      const data = await response.json();
      setRecentSongs(
        data.items.map((item: { track: SpotifyTrack }) => item.track),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Okänt fel');
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
      const token = await getSpotifyTestToken();
      if (!token) {
        setErrorMessage('Ingen Spotify-nyckel hittades. Logga in igen.');
        return;
      }

      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}&type=track&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.status === 401) {
        setErrorMessage('Spotify-nyckeln har gått ut. Logga in igen.');
        return;
      }
      if (!response.ok) {
        setErrorMessage(`Spotify svarade med fel ${response.status}.`);
        return;
      }

      const data = await response.json();
      setTracks(data.tracks.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Okänt fel');
    } finally {
      setLoading(false);
    }
  }

  async function confirmSelection() {
    if (!selectedTrack || saving) return;

    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) {
        Alert.alert('Inte inloggad', 'Logga in för att välja dagens låt.');
        return;
      }

      const image = selectedTrack.album.images[0];
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('daily_songs').insert({
        user_id: userData.user.id,
        song_date: today,
        spotify_track_id: selectedTrack.id,
        track_name: selectedTrack.name,
        artist_name: selectedTrack.artists.map((artist) => artist.name).join(', '),
        image_url: image?.url ?? null,
      });

      if (error) throw error;
      Alert.alert(
        'Klart',
        `${selectedTrack.name} är vald som dagens låt.`,
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
      setSelectedTrack(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Okänt fel';
      Alert.alert('Kunde inte spara låten', message);
    } finally {
      setSaving(false);
    }
  }

  function renderTrack(track: SpotifyTrack, compact = false) {
    const image = track.album.images[track.album.images.length - 1];
    const selected = selectedTrack?.id === track.id;

    return (
      <Pressable
        style={[
          compact ? styles.recentItem : styles.row,
          selected && [styles.selected, { backgroundColor: theme.backgroundSelected, borderColor: theme.text }],
        ]}
        onPress={() => setSelectedTrack(track)}
        accessibilityRole="button"
        accessibilityLabel={`Välj ${track.name}`}
      >
        {image && <Image source={{ uri: image.url }} style={compact ? styles.recentCover : styles.cover} />}
        <View style={compact ? styles.recentText : styles.rowText}>
          <ThemedText style={styles.trackName} numberOfLines={1}>{track.name}</ThemedText>
          <ThemedText style={styles.artist} numberOfLines={1}>
            {track.artists.map((artist) => artist.name).join(', ')}
          </ThemedText>
        </View>
        {selected && <Ionicons name="checkmark-circle" size={22} />}
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
          keyExtractor={(track) => track.id}
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
                  keyExtractor={(track) => `recent-${track.id}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentList}
                  renderItem={({ item }) => renderTrack(item, true)}
                  ListEmptyComponent={
                    <ThemedText style={styles.muted}>Inga recent tracks hittades.</ThemedText>
                  }
                />
              )}
              <ThemedText type="subtitle" style={styles.sectionTitle}>Search results</ThemedText>
              {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}
            </>
          }
          renderItem={({ item }) => renderTrack(item)}
          ListEmptyComponent={
            !loading ? <ThemedText style={styles.muted}>Sök efter en låt för att se resultat.</ThemedText> : null
          }
        />

        <View style={[styles.searchOverlay, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
          <GlassContainer spacing={8} style={styles.searchRow}>
            <GlassView style={[styles.searchField, !glassSupported && styles.fallback]} glassEffectStyle="regular">
              <Ionicons name="search" size={18} />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                placeholder="Sök efter en låt"
                returnKeyType="search"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </GlassView>
            <GlassView style={[styles.searchButton, !glassSupported && styles.fallback]} glassEffectStyle="regular" isInteractive>
              <Pressable onPress={handleSearch} disabled={loading} style={styles.searchButtonInner}>
                {loading ? <ActivityIndicator /> : <Ionicons name="arrow-forward" size={20} />}
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
            {saving ? <ActivityIndicator /> : <ThemedText style={styles.confirmText}>Bekräfta vald låt</ThemedText>}
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
  error: { marginBottom: 8 },
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
