/**
 * search-test.tsx
 *
 * TESTSKÄRM. Ska tas bort innan appen är klar.
 *
 * Söker efter låtar i Spotify Web API och visar resultatet i en lista.
 * Anropen görs direkt från appen med Spotify-nyckeln som sparades vid
 * inloggning (se spotifyTestToken.ts).
 *
 * Om nyckeln saknas eller har gått ut (efter cirka en timme) svarar Spotify
 * med 401. Användaren behöver då logga in igen för att få en ny nyckel.
 *
 * Sökfältet använder iOS Liquid Glass via expo-glass-effect och svävar
 * längst ner över listan, så att skivomslagen syns genom glaset när man
 * scrollar. På Android och iOS äldre än 26 används en vanlig grå bakgrund.
 */

import { getSpotifyTestToken } from '@/lib/spotifyTestToken';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Kontrolleras en gång när filen laddas. Är glaset inte tillgängligt
 * faller GlassView tillbaka till en genomskinlig View, så då lägger vi
 * på en egen bakgrund (styles.fallback).
 */
const glassSupported = isLiquidGlassAvailable();

/** Höjd på sökfältet och knappen. Används även för listans nedre marginal. */
const SEARCH_BAR_HEIGHT = 48;

/**
 * De delar av Spotifys låtobjekt som skärmen använder.
 * Spotify returnerar betydligt fler fält, men endast dessa behövs här.
 */
type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string; width: number }[] };
};

export default function SearchTestScreen() {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Behövs för att sökfältet inte ska hamna under hemindikatorn.
  const insets = useSafeAreaInsets();

  /**
   * Skickar sökningen till Spotify och sparar resultatet.
   */
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

      // encodeURIComponent gör sökordet säkert att använda i en adress,
      // till exempel blir mellanslag %20.
      const url =
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}` +
        `&type=track&limit=10`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        setErrorMessage('Spotify-nyckeln har gått ut. Logga in igen.');
        return;
      }
      if (!response.ok) {
        setErrorMessage(`Spotify svarade med fel ${response.status}.`);
        return;
      }

      // Svaret har formen { tracks: { items: [...] } }.
      const data = await response.json();
      setTracks(data.tracks.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Okänt fel');
    } finally {
      setLoading(false);
    }
  }

  return (
    // Endast övre kanten här. Den nedre hanteras av sökfältet självt.
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Söktest</Text>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {/* Skjuter upp sökfältet när tangentbordet visas. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex}>
        <FlatList
          data={tracks}
          keyExtractor={(track) => track.id}
          // Låter en tryckning på en rad fungera även när tangentbordet är uppe.
          keyboardShouldPersistTaps="handled"
          // Plats så att sista raden inte göms bakom sökfältet.
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: SEARCH_BAR_HEIGHT + 32 + insets.bottom,
          }}
          renderItem={({ item }) => {
            // Spotify returnerar flera bildstorlekar, störst först.
            // Den minsta räcker för en lista.
            const image = item.album.images[item.album.images.length - 1];

            return (
              <View style={styles.row}>
                {image && <Image source={{ uri: image.url }} style={styles.cover} />}
                <View style={styles.rowText}>
                  <Text style={styles.trackName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.artist} numberOfLines={1}>
                    {item.artists.map((artist) => artist.name).join(', ')}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/*
          Svävande sökfält. pointerEvents="box-none" gör att tryck utanför
          själva fältet går igenom till listan bakom.
        */}
        <View
          style={[styles.searchOverlay, { paddingBottom: insets.bottom + 8 }]}
          pointerEvents="box-none"
        >
          {/* GlassContainer låter fältet och knappen smälta ihop visuellt. */}
          <GlassContainer spacing={10} style={styles.searchRow}>
            <GlassView
              style={[styles.searchField, !glassSupported && styles.fallback]}
              glassEffectStyle="regular"
            >
              <Ionicons name="search" size={18} color="#8e8e93" />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                placeholder="Sök efter en låt"
                placeholderTextColor="#8e8e93"
                returnKeyType="search"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </GlassView>

            {/*
              isInteractive ger glaset iOS-reaktionen vid tryck. Den kan bara
              sättas vid montering. Använd inte opacity för att visa att
              knappen är inaktiv, det gör att glaset renderas fel.
            */}
            <GlassView
              style={[styles.searchButton, !glassSupported && styles.fallback]}
              glassEffectStyle="regular"
              isInteractive
            >
              <Pressable
                onPress={handleSearch}
                disabled={loading}
                style={styles.searchButtonInner}
                accessibilityRole="button"
                accessibilityLabel="Sök"
              >
                {loading ? (
                  <ActivityIndicator />
                ) : (
                  <Ionicons name="arrow-forward" size={20} color="#000" />
                )}
              </Pressable>
            </GlassView>
          </GlassContainer>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, paddingHorizontal: 16 },
  error: { color: '#c00', marginBottom: 12, paddingHorizontal: 16 },

  // Listan
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  cover: { width: 48, height: 48, borderRadius: 4 },
  rowText: { flex: 1 },
  trackName: { fontSize: 16, fontWeight: '600' },
  artist: { fontSize: 14, color: '#666' },

  // Sökfältet
  searchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: SEARCH_BAR_HEIGHT,
    borderRadius: SEARCH_BAR_HEIGHT / 2, // halva höjden ger kapselform
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: 0 },
  searchButton: {
    width: SEARCH_BAR_HEIGHT,
    height: SEARCH_BAR_HEIGHT,
    borderRadius: SEARCH_BAR_HEIGHT / 2,
  },
  searchButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Används när Liquid Glass inte finns (Android, iOS < 26).
  fallback: { backgroundColor: 'rgba(240, 240, 240, 0.95)' },
});