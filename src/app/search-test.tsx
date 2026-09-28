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
 */

import { getSpotifyTestToken } from '@/lib/spotifyTestToken';
import { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  /**
   * Skickar sökningen till Spotify och sparar resultatet.
   */
  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;

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
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Söktest</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          placeholder="Sök efter en låt"
          returnKeyType="search"
          autoCorrect={false}
        />
        <Pressable style={styles.button} onPress={handleSearch} disabled={loading}>
          <Text style={styles.buttonText}>Sök</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator style={styles.spacing} />}
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <FlatList
        data={tracks}
        keyExtractor={(track) => track.id}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  button: { backgroundColor: '#1DB954', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  spacing: { marginVertical: 12 },
  error: { color: '#c00', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  cover: { width: 48, height: 48, borderRadius: 4 },
  rowText: { flex: 1 },
  trackName: { fontSize: 16, fontWeight: '600' },
  artist: { fontSize: 14, color: '#666' },
});