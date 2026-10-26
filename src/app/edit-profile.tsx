/**
 * edit-profile.tsx
 *
 * Visar den inloggade användarens profil och sex platser för favoritalbum.
 * Användaren kan ändra sitt visningsnamn och sin biografi.
 *
 * Skärmen läser och skriver direkt mot Supabase. Databasens RLS-policyer
 * säkerställer att användaren endast kan ändra sin egen profil, och
 * kolumnrättigheterna att endast tillåtna fält kan ändras.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedTouchableOpacity } from '@/components/themed-touchable-oppacity';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { getMySpotifyProfile, searchAlbums } from '@/lib/spotifyData';
import { SpotifyNotConnectedError } from '@/lib/spotifySearch';
import { supabase } from '@/lib/supabase';
import { ComponentSize, Radius, Spacing, Typography } from '@/constants/theme';
import { createTextStyles } from '@/styles/text';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ColorValue,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Antal platser för favoritalbum. Motsvarar check-regeln i databasen. */
const ALBUM_SLOTS = 6;
const glassSupported = isLiquidGlassAvailable();
const SEARCH_BAR_HEIGHT = 48;

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
  Alert.alert(title, error instanceof Error ? error.message : 'Unknown error');
}

type Colors = {
  label: ColorValue;
  secondaryLabel: ColorValue;
  placeholder: ColorValue;
  separator: ColorValue;
  highlight: ColorValue;
  fill: ColorValue;
  popup: ColorValue;
  tint: ColorValue;
  onTint: ColorValue;
  red: ColorValue;
};

function useColors(): Colors {
  const theme = useTheme();

  return {
    label: theme.text,
    secondaryLabel: theme.textSecondary,
    placeholder: theme.textSecondary,
    separator: theme.backgroundSelected,
    highlight: theme.backgroundSelected,
    fill: theme.backgroundElement,
    popup: theme.background,
    tint: theme.accentIndigo,
    onTint: theme.accentText,
    red: theme.destructiveText,
  };
}

export default function EditProfileScreen() {
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCounter = useRef(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [albums, setAlbums] = useState<FavoriteAlbum[]>([]);
  const [spotifyAlbumSearchResult, setSpotifyAlbumSearchResult] = useState<SpotifyAlbumSearchResult[]>([]);
  const [albumQuery, setAlbumQuery] = useState('');
  const [editAlbumIndex, setEditAlbumIndex] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [biography, setBiography] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const theme = useTheme();
  const colors = useColors();
  const textStyles = createTextStyles(theme);

  /**
   * Hämtar profilen och favoritalbumen för den inloggade användaren.
   */
  async function loadProfile() {
    setLoading(true);
    try {
      // Hämtar den inloggade användaren från Supabase-sessionen.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        Alert.alert('Not logged in', 'Log in to view your profile.');
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Could not fetch profile', message);
    } finally {
      setLoading(false);
    }
  }

    async function loadSpotifyProfile() {
    try {
      const data = await getMySpotifyProfile();
      setSpotifyProfile({ user_name: data.display_name, image_url: data.image_url });
    } catch (error) {
      handleSpotifyError(error, 'Kunde inte hämta Spotify-profilen');
    }
  }

    /**
   * Hämtar användarens nuvarande profilbild från Spotify och sparar den i
   * databasen, så att den syns för alla: på profilen, för andra och i
   * flödet. Används när användaren har bytt bild på Spotify efter sin
   * första inloggning.
   */
  async function updateAvatarFromSpotify() {
    setUpdatingAvatar(true);
    try {
      const spotifyData = await getMySpotifyProfile();

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: spotifyData.image_url })
        .eq('id', userData.user.id);
      if (error) throw error;

      // Visar den nya bilden direkt på sidan.
      setProfile((current) =>
        current ? { ...current, avatar_url: spotifyData.image_url } : current
      );
      Alert.alert('Updated', 'Your profile picture has been updated from Spotify.');
    } catch (error) {
      handleSpotifyError(error, 'Could not update profile picture');
    } finally {
      setUpdatingAvatar(false);
    }
  }

  // Laddar om profilen varje gång skärmen visas, även när användaren
  // kommer tillbaka från en annan skärm. Det gör att nya album syns direkt
  // efter att de valts i nästa steg.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadSpotifyProfile();
    }, [])
  );

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

      Alert.alert('Saved', 'The profile and favorite albums have been updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Could not save', message);
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
        <ThemedText>Ingen profil hittades.</ThemedText>
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
         <SafeAreaView style={styles.screen} edges={['bottom']}>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, width: '100%' }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          >

        <Text style={[styles.title, { color: theme.text }]}>Välj album för plats {editAlbumIndex}</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentAlbumSearch}  >

          <Text style={[textStyles.pageTitle, styles.largeTitle]} accessibilityRole="header">
            Add favorite album
          </Text>
          <Text style={[textStyles.pageSubtitle, styles.subtitle]}>
            Add your favorite albums to your profile. You can choose up to 6 albums.
          </Text>

          <Text style={[textStyles.sectionTitle, styles.sectionTitle]} accessibilityRole="header">
            Search Results
          </Text>

          {spotifyAlbumSearchResult.length === 0 && (
            <Text style={[textStyles.pageSubtitle, styles.subtitle]}>
              Search for a song to see results.
            </Text>
          )}

          {spotifyAlbumSearchResult.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.addAlbumImage,
                {borderBottomColor: colors.separator, borderBottomWidth: 1},
                pressed && { backgroundColor: colors.highlight },
              ]}
              onPress={() => selectFavoriteAlbum(item)}
            >
              {item.image_url && (
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: 48, height: 48 }}
                />
              )}
              <View>
                <ThemedText style={styles.addAlbumNameText}>{item.album_name}</ThemedText>
                <ThemedText style={styles.addAlbumArtistNameText}>{item.artist_name}</ThemedText>
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <GlassContainer spacing={8} style={styles.searchRow}>
              <GlassView style={[styles.searchField, !glassSupported && styles.fallback]} glassEffectStyle="regular">
                <Ionicons name="search" size={18} color={colors.secondaryLabel as any} />
                <ThemedTextInput
                  style={[styles.searchInput]}
                  value={albumQuery}
                  onChangeText={searchAlbum}
                  placeholder="Search for a album"
                  placeholderTextColor={colors.secondaryLabel as any}
                  returnKeyType="search"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </GlassView>

             <TouchableOpacity 
                onPress={() => {
                  searchAlbum('');
                  setEditAlbumIndex(null);
                }}
              >
                <GlassView style={[styles.searchCloseButton, !glassSupported && styles.fallback]} glassEffectStyle="regular">
                  <Ionicons name="close" size={20} color={colors.label as any} />
                </GlassView>
             </TouchableOpacity>
            </GlassContainer>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[textStyles.pageTitle, styles.largeTitle]} accessibilityRole="header">
            Edit Profile
          </Text>

        <View style={styles.profileImageContainer}>
          {profile.avatar_url && (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          )}
          <ThemedText style={styles.spotifyNameLabel}>{spotifyProfile?.user_name ? '@' + spotifyProfile.user_name : 'Inget namn angivet'}</ThemedText>
          <Pressable
            style={[
              styles.avatarButton,
              { borderColor: theme.backgroundSelected },
              updatingAvatar && styles.avatarButtonDisabled,
            ]}
            onPress={updateAvatarFromSpotify}
            disabled={updatingAvatar}
          >
            <ThemedText style={styles.avatarButtonText}>
              {updatingAvatar ? 'Updating...' : 'Update picture from Spotify'}
            </ThemedText>
          </Pressable>
        </View>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Display Name</ThemedText>
          <ThemedTextInput
            style={[styles.displayNameStyle, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ditt namn"
          />

          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Biography</ThemedText>
          <ThemedTextInput
            style={[styles.multiline, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
            value={biography}
            onChangeText={setBiography}
            placeholder="Berätta något om dig själv"
            multiline
          />

          <ThemedText style={[textStyles.sectionTitle, styles.sectionTitle]}>Favorite albums</ThemedText>
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
                    <View style={[styles.albumCover, styles.emptyCover, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>{index + 1}</ThemedText>
                    </View>
                  )}
                  </TouchableOpacity>
                 {/* knapp för att ta bort favoritalbum.*/}
                 {album && (
                  <ThemedTouchableOpacity
                   style={styles.removeButton}
                   onPress={() => removeFavoriteAlbum(index + 1)}
                  >
                    <ThemedText style={styles.removeButtonText}>✕</ThemedText>
                  </ThemedTouchableOpacity>
                 )}
                </View>
              
                <ThemedText style={styles.albumName} numberOfLines={1}>
                  {album?.album_name ?? 'Empty slot'}
                </ThemedText>
                {album && (
                  <ThemedText style={[styles.albumArtist, { color: theme.textSecondary }]} numberOfLines={1}>
                    {album.artist_name}
                  </ThemedText>
                )}
              </View>
           ))}
          </View>

          <Pressable
            style={[styles.button, { backgroundColor: theme.accentIndigo }]}
            onPress={handleSave}
            disabled={saving}
          >
            <ThemedText style={[styles.buttonText, { color: theme.accentText }]}>
              {saving ? 'Saving...' : 'Save changes'}
            </ThemedText>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.four },
  largeTitle: { marginBottom: Spacing.two },
  subtitle: { marginTop: Spacing.one },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.seven, paddingBottom: Spacing.six, gap: Spacing.three },
  contentAlbumSearch: { paddingHorizontal: Spacing.three, paddingTop: Spacing.seven, paddingBottom: Spacing.six },
  title: { ...Typography.sectionTitle, marginBottom: Spacing.two },
  avatar: { width: 80, height: 80, borderRadius: Radius.large, marginBottom: Spacing.two },
  label: { ...Typography.bodySmall, fontWeight: '600', marginTop: Spacing.two },
  spotifyNameLabel: { ...Typography.bodySmall, marginBottom: Spacing.two },
  input: { borderWidth: 1, borderRadius: Radius.small, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  searchInput: { marginHorizontal: 0, paddingHorizontal: 0, paddingVertical: 0, ...Typography.bodySmall, flex: 1 },
  addAlbumNameText: { borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, ...Typography.body },
  addAlbumArtistNameText: { borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, ...Typography.bodySmall },
  addAlbumImage: { paddingVertical: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: 0, marginHorizontal: 0 },
  multiline: { minHeight: 80, textAlignVertical: 'top', borderWidth: 1 },
  displayNameStyle: { borderWidth: 1 },
  button: { borderRadius: Radius.pill, paddingVertical: Spacing.two, alignItems: 'center', marginTop: Spacing.two },
  buttonText: { fontWeight: '600', ...Typography.body },
  sectionTitle: { marginTop: Spacing.two, marginBottom: Spacing.one },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  slot: { width: '30%' },
  albumCover: { width: '100%', aspectRatio: 1 },
  emptyCover: { justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...Typography.body, textAlign: 'center' },
  albumName: { ...Typography.bodySmall, fontWeight: '600', marginTop: Spacing.one },
  albumArtist: { ...Typography.caption, marginTop: Spacing.half },
  profileImageContainer: { width: '100%', alignItems: 'flex-start', marginTop: Spacing.one, marginBottom: Spacing.two },

  // Senaste låtar
  songRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.two },
  songCover: { width: 50, height: 50 },
  songName: { ...Typography.bodySmall, fontWeight: '600' },
  songArtist: { ...Typography.caption },

  avatarButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  avatarButtonDisabled: { opacity: 0.5 },
  avatarButtonText: { ...Typography.bodySmall, fontWeight: '600' },

  removeButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: ComponentSize.avatar.default,
    height: ComponentSize.avatar.default,
    marginTop: -16,
    marginLeft: -20,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    ...Typography.body,
    fontWeight: 'bold',
  },

    searchButton: { width: SEARCH_BAR_HEIGHT, height: SEARCH_BAR_HEIGHT, borderRadius: Radius.large },
    searchButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    fallback: { borderWidth: StyleSheet.hairlineWidth },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: 0, marginHorizontal: 0 },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, height: SEARCH_BAR_HEIGHT, borderRadius: Radius.large, paddingHorizontal: Spacing.three },
  searchCloseButton: { width: SEARCH_BAR_HEIGHT, height: SEARCH_BAR_HEIGHT, borderRadius: SEARCH_BAR_HEIGHT/2, alignItems: 'center', justifyContent: 'center' },
});