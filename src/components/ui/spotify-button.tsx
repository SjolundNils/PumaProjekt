/**
 * spotify-button.tsx
 *
 * Den gröna Spotify-knappen: Spotify-loggan och en pil. Ett tryck öppnar
 * länken i Spotify (appen om den finns, annars webbspelaren).
 *
 * Används för länkar till låtar och spellistor:
 *
 *   <SpotifyButton url={spotifyTrackUrl(song.spotify_track_id)} />
 *   <SpotifyButton url={spotifyPlaylistUrl(group.spotify_playlist_id)} size="medium" />
 *
 * Är url null eller undefined visas ingenting, så anroparen behöver inte
 * kontrollera det själv.
 *
 * Knappen har egen tryckyta, så den kan ligga inuti en rad som också går
 * att trycka på (till exempel ett inlägg i flödet) utan att raden triggas.
 */

import { FontAwesome5 } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { Alert, Linking, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type Size = 'small' | 'medium';

type Props = {
  /** Adressen som öppnas. Null eller undefined gör att knappen inte visas. */
  url: string | null | undefined;
  size?: Size;
  style?: StyleProp<ViewStyle>;
};

// Spotifys färger. Fungerar likadant i ljust och mörkt läge.
const SPOTIFY_GREEN = '#1ED760';
const SPOTIFY_BLACK = '#191414';

// Måtten för de två storlekarna: cirklarnas diameter, ikonstorlek, avstånd
const SIZES = {
  small: { circle: 22, icon: 15, arrow: 16, padding: 3, gap: 0 },
  medium: { circle: 28, icon: 19, arrow: 20, padding: 4, gap: 0 },
} as const;

export function SpotifyButton({ url, size = 'small', style }: Props) {
  if (!url) return null;

  const s = SIZES[size];

  async function open() {
    try {
      await Linking.openURL(url as string);
    } catch {
      Alert.alert('Could not open Spotify', 'Try again in a moment.');
    }
  }

  const circle = {
    width: s.circle,
    height: s.circle,
    borderRadius: s.circle / 2,
  };

  return (
    <Pressable
      onPress={open}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel="Open in Spotify"
      style={({ pressed }) => [
        styles.pill,
        { padding: s.padding, gap: s.gap, borderRadius: (s.circle + s.padding * 2) / 2 },
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.circle, circle]}>
        <FontAwesome5 name="spotify" brand size={s.icon} color={SPOTIFY_BLACK} />
      </View>
      <View style={[styles.circle, circle]}>
  		<SymbolView
    	  name="arrow.up.right"
    	  size={s.arrow}
    	  tintColor={SPOTIFY_BLACK}
    	  type="monochrome"
  		/>
	  </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: SPOTIFY_GREEN,
  },
  circle: {
    backgroundColor: SPOTIFY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});