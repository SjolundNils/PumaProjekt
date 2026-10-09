/**
 * album-grid.tsx
 *
 * Visar de sex platserna för favoritalbum i ett rutnät med tre kolumner.
 *
 * Används både för att visa och redigera en profil:
 *   - Utan onPressSlot och onRemove visas albumen bara. Tomma platser
 *     visas som tomma rutor.
 *   - Med onPressSlot går varje plats att trycka på, och tomma platser
 *     visar sitt nummer. Med onRemove visas en knapp för att ta bort
 *     albumet på platsen.
 *
 * Exempel:
 *   <AlbumGrid albums={albums} />
 *   <AlbumGrid albums={albums} onPressSlot={pick} onRemove={remove} />
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { toAlbumSlots, type FavoriteAlbum } from '@/lib/profile';

type Props = {
  albums: FavoriteAlbum[];
  /** Anropas med platsens nummer (1–6) när användaren trycker på den. */
  onPressSlot?: (position: number) => void;
  /** Anropas med platsens nummer när användaren tar bort albumet. */
  onRemove?: (position: number) => void;
};

export function AlbumGrid({ albums, onPressSlot, onRemove }: Props) {
  const editable = onPressSlot !== undefined;

  return (
    <View style={styles.grid}>
      {toAlbumSlots(albums).map((album, index) => {
        const position = index + 1;

        return (
          <View key={position} style={styles.slot}>
            <Pressable
              onPress={() => onPressSlot?.(position)}
              disabled={!editable}
              accessibilityLabel={
                album ? `${album.album_name} by ${album.artist_name}` : `Empty slot ${position}`
              }
            >
              {album?.image_url ? (
                <Image source={{ uri: album.image_url }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.empty]}>
                  {editable && <Ionicons name="add" size={28} color="#999" />}
                </View>
              )}
            </Pressable>

            {album && onRemove && (
              <Pressable
                style={styles.removeButton}
                onPress={() => onRemove(position)}
                hitSlop={8}
                accessibilityLabel={`Remove ${album.album_name}`}
              >
                <Ionicons name="close" size={16} color="#000" />
              </Pressable>
            )}

            {album && (
              <>
                <ThemedText style={styles.albumName} numberOfLines={1}>
                  {album.album_name}
                </ThemedText>
                <ThemedText style={styles.artist} numberOfLines={1}>
                  {album.artist_name}
                </ThemedText>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slot: { width: '30%' },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  empty: { backgroundColor: 'rgba(128, 128, 128, 0.15)', justifyContent: 'center', alignItems: 'center' },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumName: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  artist: { fontSize: 12, opacity: 0.6 },
});