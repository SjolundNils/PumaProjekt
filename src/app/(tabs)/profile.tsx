/**
 * profile.tsx
 *
 * Visar den inloggade användarens profil och sex platser för favoritalbum.
 * Användaren kan ändra sitt visningsnamn och sin biografi.
 *
 * Skärmen läser och skriver direkt mot Supabase. Databasens RLS-policyer
 * säkerställer att användaren endast kan ändra sin egen profil, och
 * kolumnrättigheterna att endast tillåtna fält kan ändras.
 */

import { signOut } from '@/lib/auth';
import { getRecentlyPlayed, getSpotifyProfile, RecentTrack, searchAlbums } from '@/lib/spotifyData';
import { SpotifyNotConnectedError } from '@/lib/spotifySearch';
import { supabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

type SpotifyProfile = {
  user_name: string | null;
  image_url: string | null;
};

type FavoriteAlbum = {
  spotify_album_id: string;
  position: number;
  album_name: string;
  artist_name: string;
  image_url: string | null;
};

type SpotifyAlbumSearchResult = {
  id: string;
  album_name: string;
  artist_name: string;
  image_url: string | null;
};

type DailySong = {
  track_name: string;
  artist_name: string;
  image_url: string | null;
  song_date: string;
}

/** Skickar användaren till inloggningen om Spotify-kopplingen saknas, annars visas felet. */
function handleSpotifyError(error: unknown, title: string) {
  if (error instanceof SpotifyNotConnectedError) {
    router.replace('/login');
    return;
  }
  Alert.alert(title, error instanceof Error ? error.message : 'Okänt fel');
}

export default function ProfileScreen() {
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCounter = useRef(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [albums, setAlbums] = useState<FavoriteAlbum[]>([]);
  const [spotifyAlbumSearchResult, setSpotifyAlbumSearchResult] = useState<SpotifyAlbumSearchResult[]>([]);
  const [albumQuery, setAlbumQuery] = useState('');
  const [editAlbumIndex, setEditAlbumIndex] = useState<number | null>(null);
  const [recentSongs, setRecentSongs] = useState<RecentTrack[]>([]);
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
          .select('spotify_album_id, position, album_name, artist_name, image_url')
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

    async function loadSpotifyProfile() {
    try {
      const data = await getSpotifyProfile();
      setSpotifyProfile({ user_name: data.display_name, image_url: data.image_url });
    } catch (error) {
      handleSpotifyError(error, 'Kunde inte hämta Spotify-profilen');
    }
  }

  // Laddar om profilen varje gång skärmen visas, även när användaren
  // kommer tillbaka från en annan skärm. Det gör att nya album syns direkt
  // efter att de valts i nästa steg.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadSpotifyProfile();
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

      const { data: today, error: dateError } = await supabase.rpc('app_today');
      if (dateError || !today) {
        console.log('Kunde inte hämta dagens datum', dateError);
        return;
      }

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

    const searchAlbum = (text: string) => {
    setAlbumQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      searchCounter.current++; // ogiltigförklarar sökningar som är på väg
      setSpotifyAlbumSearchResult([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      const id = ++searchCounter.current;
      try {
        const result = await searchAlbums(trimmed);
        if (id === searchCounter.current) setSpotifyAlbumSearchResult(result);
      } catch (error) {
        handleSpotifyError(error, 'Kunde inte söka album');
      }
    }, 400);
  };

  const selectFavoriteAlbum = (selected: SpotifyAlbumSearchResult) => {
    if (editAlbumIndex === null) return;

    const newAlbum: FavoriteAlbum = {
      spotify_album_id: selected.id,
      position: editAlbumIndex,
      album_name: selected.album_name,
      artist_name: selected.artist_name,
      image_url: selected.image_url,
    };

    setAlbums((prev) => [...prev.filter((a) => a.position !== editAlbumIndex), newAlbum]);
    console.log('setAlbums:', albums);
    setEditAlbumIndex(null);
    setAlbumQuery('');
    setSpotifyAlbumSearchResult([]);
  };

  /**
   * Sparar ändrat visningsnamn och biografi.
   */
  async function handleSave() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const userId = userData.user.id;

      // Profilen och albumen hämtas parallellt, eftersom de är oberoende.
      const [profileResult, albumsDeleteResult] = await Promise.all([
        supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          biography: biography.trim() || null,
        })
        .eq('id', userData.user.id),
        // ta bort alla album för användaren innan man sätter in nya
        // detta är bara nödvändigt om man tillåter att ta bort favorite albums
       supabase
        .from('favorite_albums')
        .delete()
        .eq('user_id', userData.user.id),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (albumsDeleteResult.error) throw albumsDeleteResult.error;

      if (albums.length > 0) {
        const albumsToSave = albums.map((album) => ({
          user_id: userId,
          position: album.position,
          spotify_album_id: album.spotify_album_id ?? null,
          album_name: album.album_name,
          artist_name: album.artist_name,
          image_url: album.image_url,
        }));
        
        // update eller insert favorite albums. Där userId och positioner passar.
        const { error: upsertError } = await supabase
          .from('favorite_albums')
          .upsert(albumsToSave, { onConflict: 'user_id, position' });

        if (upsertError) throw upsertError;
      }

      Alert.alert('Sparat', 'Profilen och favoritalbum har uppdaterats.');
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

  const removeFavoriteAlbum = (position: number) => {
  setAlbums((prev) => prev.filter((album) => album.position !== position));
  };

  // Bygger en lista med exakt sex platser. Platser utan album blir null,
  // så att tomma platser också kan visas.
  const slots = Array.from({ length: ALBUM_SLOTS }, (_, index) => {
    const position = index + 1;
    return albums.find((album) => album.position === position) ?? null;
  });

  if (editAlbumIndex !== null) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setEditAlbumIndex(null)}>
          <Text style={styles.label}>← Tillbaka</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Välj album för plats {editAlbumIndex}</Text>

        <TextInput
          style={styles.input}
          placeholder="Sök efter album"
          placeholderTextColor="#888"
          value={albumQuery}
          onChangeText={searchAlbum}
        />

        {spotifyAlbumSearchResult.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.input}
            onPress={() => selectFavoriteAlbum(item)}
          >
            {item.image_url && (
              <Image
                source={{ uri: item.image_url }}
                style={{ width: 48, height: 48, borderRadius: 4 }}
              />
            )}
            <View>
              <Text style={styles.input}>{item.album_name}</Text>
              <Text style={styles.input}>{item.artist_name}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profiltest</Text>

        <View style={styles.profileImageContainer}>
          {spotifyProfile?.image_url && (
            <Image source={{ uri: spotifyProfile.image_url }} style={styles.avatar} />
          )}
        </View>

        <Text style={styles.label}>Visningsnamn</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ditt namn"
        />
        <Text style={styles.label}>{spotifyProfile?.user_name ? '@' + spotifyProfile.user_name : 'Inget namn angivet'}</Text>

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
              <View>
                <TouchableOpacity
                 activeOpacity={0.8}
                 onPress={() => setEditAlbumIndex(index + 1)}
                >
                {album?.image_url ? (
                  <Image source={{ uri: album.image_url }} style={styles.albumCover} />
                ) : (
                  <View style={[styles.albumCover, styles.emptyCover]}>
                    <Text style={styles.emptyText}>{index + 1}</Text>
                  </View>
                )}
                </TouchableOpacity>
               {/* knapp för att ta bort favoritalbum.*/}
               {album && (
                <TouchableOpacity
                 style={styles.removeButton}
                 onPress={() => removeFavoriteAlbum(index + 1)}
               >
                <Text style={styles.removeButtonText}>✕</Text>
               </TouchableOpacity>
               )}
              </View>
              
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
          <View key={`${song.id}-${song.played_at}`} style={styles.songRow}>
            {song.image_url && (
              <Image source={{ uri: song.image_url }} style={styles.songCover} />
            )}

            <View>
              <Text style={styles.songName}>{song.name}</Text>
              <Text style={styles.songArtist}>{song.artist_name}</Text>
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
      setRecentSongs(await getRecentlyPlayed());
    } catch (error) {
      // Senaste låtar är inte kritiskt: bara en logg, utom när kopplingen saknas
      if (error instanceof SpotifyNotConnectedError) {
        router.replace('/login');
        return;
      }
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
  profileImageContainer: { width: '100%', alignItems: 'center', marginTop: 8, marginBottom: 8 },

  // Senaste låtar
  songRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8},
  songCover: {width: 50, height: 50, borderRadius: 4},
  songName: {fontSize: 15, fontWeight: '600'},
  songArtist: {fontSize: 13, color: '#666'},

  removeButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 32,
    height: 32,
    marginTop: -16,
    marginLeft: -16,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});