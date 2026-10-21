/**
 * search-bar.tsx
 *
 * Sökfält med iOS Liquid Glass och en rund knapp med ett kryss bredvid,
 * som i add-song och i designen för Add Members.
 *
 *   <SearchBar value={query} onChangeText={setQuery} onClose={() => setQuery('')} />
 *
 * På Android och iOS äldre än 26 används en vanlig grå bakgrund i stället
 * för glaset. Färgerna kommer från temat, så fältet följer ljust och
 * mörkt läge.
 */

import { Ionicons } from '@expo/vector-icons';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const glassSupported = isLiquidGlassAvailable();
const HEIGHT = 48;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  /** Anropas när användaren trycker på krysset. */
  onClose: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function SearchBar({ value, onChangeText, onClose, placeholder = 'Search', autoFocus = false }: Props) {
  const theme = useTheme();
  // Utan glas behövs en egen bakgrund, annars syns fältet inte
  const fallback = !glassSupported && { backgroundColor: theme.backgroundElement };

  return (
    <GlassContainer spacing={8} style={styles.row}>
      <GlassView style={[styles.field, fallback]} glassEffectStyle="regular">
        <SymbolView
          name="magnifyingglass"
          size={17}
          tintColor={theme.textSecondary}
          fallback={<Ionicons name="search" size={18} color={theme.textSecondary} />}
        />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </GlassView>

      <GlassView style={[styles.button, fallback]} glassEffectStyle="regular">
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.buttonInner, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <SymbolView
            name="xmark"
            size={17}
            weight="semibold"
            tintColor={theme.text}
            fallback={<Ionicons name="close" size={20} color={theme.text} />}
          />
        </Pressable>
      </GlassView>
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: 0 },
  button: { width: HEIGHT, height: HEIGHT, borderRadius: HEIGHT / 2 },
  buttonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});