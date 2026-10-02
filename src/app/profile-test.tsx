/**
 * profile-test.tsx
 *
 * TESTSKÄRM. Ska ersättas av den riktiga profilskärmen.
 *
 * Visar den inloggade användarens profil och sex platser för favoritalbum.
 * Användaren kan ändra sitt visningsnamn och sin biografi.
 *
 * Skärmen läser och skriver direkt mot Supabase. Databasens RLS-policyer
 * säkerställer att användaren endast kan ändra sin egen profil, och
 * kolumnrättigheterna att endast tillåtna fält kan ändras.
 */

import { signOut } from '@/lib/auth';
import { getSpotifyTestToken } from '@/lib/spotifyTestToken';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Antal platser för favoritalbum. Motsvarar check-regeln i databasen. */
const ALBUM_SLOTS = 6;

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  biography: string | null;
};

type FavoriteAlbum = {
  position: number;
  album_name: string;
  artist_name: string;
  image_url: string | null;
};

type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[];};
};

type DailySong = {
  track_name: string;
  artist_name: string;
  image_url: string | null;
  song_date: string;
}

export default function ProfileTestScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [albums, setAlbums] = useState<FavoriteAlbum[]>([]);
  const [recentSongs, setRecentSongs] = useState<SpotifyTrack[]>([]);
  const [dailySong, setDailySong] = useState<DailySong | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [biography, setBiography] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /**
   * Hämtar profilen och favoritalbumen för den inloggade användaren.
   */
  async function loadProfile() {
    setLoading(true);
    try {
      // Hämtar den inloggade användaren från Supabase-sessionen.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        Alert.alert('Inte inloggad', 'Logga in för att se din profil.');
        return;
      }
      const userId = userData.user.id;

      // Profilen och albumen hämtas parallellt, eftersom de är oberoende.
      const [profileResult, albumsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, avatar_url, biography')
          .eq('id', userId)
          .single(),
        supabase
          .from('favorite_albums')
          .select('position, album_name, artist_name, image_url')
          .eq('user_id', userId)
          .order('position'),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (albumsResult.error) throw albumsResult.error;

      setProfile(profileResult.data);
      setDisplayName(profileResult.data.display_name ?? '');
      setBiography(profileResult.data.biography ?? '');
      setAlbums(albumsResult.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Okänt fel';
      Alert.alert('Kunde inte hämta profilen', message);
    } finally {
      setLoading(false);
    }
  }

  // Laddar om profilen varje gång skärmen visas, även när användaren
  // kommer tillbaka från en annan skärm. Det gör att nya album syns direkt
  // efter att de valts i nästa steg.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadRecentSongs();
      loadDailySong();
    }, [])
  );

  async function loadDailySong() {
    try{
      const {data: userData} = await supabase.auth.getUser();

      if(!userData.user){
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const {data, error} = await supabase
        .from('daily_songs')
        .select('track_name, artist_name, image_url, song_date')
        .eq('user_id', userData.user.id)
        .eq('song_date', today)
        .maybeSingle();

      if(error){
        console.log('Kunde inte hämta dagens låt', error);
        return;
      }

      setDailySong(data);
    } catch (error) {
      console.log('Fel när dagens låt hämtadas', error);
    }
  }

  /**
   * Sparar ändrat visningsnamn och biografi.
   */
  async function handleSave() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          biography: biography.trim() || null,
        })
        .eq('id', userData.user.id);

      if (error) throw error;
      Alert.alert('Sparat', 'Profilen har uppdaterats.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Okänt fel';
      Alert.alert('Kunde inte spara', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text>Ingen profil hittades.</Text>
      </SafeAreaView>
    );
  }

  // Bygger en lista med exakt sex platser. Platser utan album blir null,
  // så att tomma platser också kan visas.
  const slots = Array.from({ length: ALBUM_SLOTS }, (_, index) => {
    const position = index + 1;
    return albums.find((album) => album.position === position) ?? null;
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profiltest</Text>

        {profile.avatar_url && (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        )}

        <Text style={styles.label}>Visningsnamn</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ditt namn"
        />

        <Text style={styles.label}>Biografi</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={biography}
          onChangeText={setBiography}
          placeholder="Berätta något om dig själv"
          multiline
        />

        <Pressable
          style={[styles.button, { backgroundColor: '#c0392b' }]}
          onPress={async () => {
            await signOut();
            Alert.alert('Utloggad', 'Du är nu utloggad.');
          }}
        >
          <Text style={styles.buttonText}>Logga ut</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Sparar...' : 'Spara'}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Favoritalbum</Text>
        <View style={styles.grid}>
          {slots.map((album, index) => (
            <View key={index} style={styles.slot}>
              {album?.image_url ? (
                <Image source={{ uri: album.image_url }} style={styles.albumCover} />
              ) : (
                <View style={[styles.albumCover, styles.emptyCover]}>
                  <Text style={styles.emptyText}>{index + 1}</Text>
                </View>
              )}
              <Text style={styles.albumName} numberOfLines={1}>
                {album?.album_name ?? 'Tom plats'}
              </Text>
              {album && (
                <Text style={styles.albumArtist} numberOfLines={1}>
                  {album.artist_name}
                </Text>
              )}
            </View>
          ))}
        </View>


        <Text style={styles.sectionTitle}>Recent songs</Text>

        {recentSongs.map((song) => (
          <View key={song.id} style={styles.songRow}>
            {song.album.images[0] && (
              <Image
                source={{ uri: song.album.images[0].url }}
                style={styles.songCover}
              />
            )}

            <View>
              <Text style={styles.songName}>{song.name}</Text>
              <Text style={styles.songArtist}>
                {song.artists.map((artist) => artist.name).join(', ')}
              </Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Todays song</Text>

        {dailySong ?(
          <View style={styles.songRow}>
            {dailySong.image_url && (
              <Image
                source={{ uri: dailySong.image_url }}
                style={styles.songCover}
              />
            )}

            <View>
              <Text style={styles.songName}>
                {dailySong.track_name}
              </Text>

              <Text style={styles.songArtist}>
                {dailySong.artist_name}
              </Text>
            </View>
        
          </View>
        ) : (
          <Text>No song chosen today.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  async function loadRecentSongs() {
    try {
      // Hämtar Spotify-token som sparades vid inloggningen
      const token = await getSpotifyTestToken();

      if (!token) {
        console.log('Ingen Spotify-token hittades.');
        return;
      }

      // Frågar Spotify efter de 5 senast spelade låtarna
      const response = await fetch(
        'https://api.spotify.com/v1/me/player/recently-played?limit=5',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.log('Spotify-fel:', response.status);
        return;
      }

      const data = await response.json();

      console.log('Recently played:', data);

      // Spotify returnerar varje låt inuti ett "track"-objekt.
      const tracks = data.items.map(
        (item: { track: SpotifyTrack }) => item.track
      );

      setRecentSongs(tracks);
    } catch (error) {
      console.log('Kunde inte hämta senaste låtar:', error);
    }
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#1DB954', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slot: { width: '30%' },
  albumCover: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  emptyCover: { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 20, color: '#999' },
  albumName: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  albumArtist: { fontSize: 12, color: '#666' },

  // Senaste låtar
  songRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8},
  songCover: {width: 50, height: 50, borderRadius: 4},
  songName: {fontSize: 15, fontWeight: '600'},
  songArtist: {fontSize: 13, color: '#666'},
});