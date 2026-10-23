/**
 * group-image-picker.tsx
 *
 * Fyrkantig plats för gruppens bild, utan rundade hörn, som i designen.
 * Utan bild visas ett plus, med bild visas bilden. Texten under byter mellan
 * "Add a photo" och "Change photo". Själva valet av bild görs av anroparen
 * (pickGroupImage i lib/group-avatar.ts), den här komponenten bara visar.
 *
 * Används av create-group och group/[id]/edit:
 *   <GroupImagePicker uri={image?.uri ?? currentUrl} onPress={pick} />
 */

import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const SIZE = 168;

type Props = {
  /** Bildens adress, eller null om gruppen saknar bild. */
  uri: string | null;
  onPress: () => void;
};

export function GroupImagePicker({ uri, onPress }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Change group photo' : 'Add a group photo'}
        style={({ pressed }) => [
          styles.square,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <SymbolView
            name="plus"
            size={28}
            tintColor={theme.text}
            fallback={<Ionicons name="add" size={32} color={theme.text} />}
          />
        )}
      </Pressable>
      <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
        {uri ? 'Change photo' : 'Add a photo'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // Inget borderRadius: bilden ska vara en ren fyrkant
  square: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  label: { fontSize: 16, marginTop: 12 },
  pressed: { opacity: 0.7 },
});