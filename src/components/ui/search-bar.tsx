/**
 * search-bar.tsx
 *
 * Appens sökfält: ett runt glasfält med förstoringsglas, och en valfri rund
 * glasknapp bredvid. Samma utseende som på Add Track-sidan, så att alla
 * sökfält i appen ser likadana ut.
 *
 * Fältet tar emot alla vanliga TextInput-egenskaper (value, onChangeText,
 * onSubmitEditing och så vidare). Knappen visas bara om button skickas med:
 *
 * - icon 'search' visar en pil, för att starta sökningen.
 * - icon 'close' visar ett kryss, till exempel för att rensa eller lämna
 *   sökningen.
 *
 * Med loading visas en snurra i knappen istället för ikonen.
 */
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import {
  ActivityIndicator,
  Platform,
  PlatformColor,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  ViewStyle,
} from 'react-native';

const glassSupported = isLiquidGlassAvailable();

/** Höjden på fältet och knappen. */
export const SEARCH_BAR_HEIGHT = 48;

type SearchBarButton = {
  icon: 'search' | 'close';
  onPress: () => void;
  /**
   * Körs direkt när fingret landar. Behövs om tangentbordet är uppe, annars
   * kan första trycket gå åt till att släppa tangentbordet.
   */
  onPressIn?: () => void;
  accessibilityLabel?: string;
};

type Props = Omit<TextInputProps, 'style'> & {
  ref?: React.Ref<React.ComponentRef<typeof TextInput>>;
  button?: SearchBarButton;
  loading?: boolean;
  /** Stil för hela raden, till exempel marginaler. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Färgerna i sökfältet. På iOS används systemets egna färger, som byter
 * automatiskt mellan ljust och mörkt läge. På Android används appens tema.
 */
function useSearchColors() {
  const theme = useTheme();

  if (Platform.OS === 'ios') {
    return {
      label: PlatformColor('label'),
      secondaryLabel: PlatformColor('secondaryLabel'),
      placeholder: PlatformColor('placeholderText'),
      separator: PlatformColor('separator'),
    };
  }

  return {
    label: theme.text,
    secondaryLabel: theme.textSecondary,
    placeholder: theme.textSecondary,
    separator: 'rgba(128,128,128,0.3)',
  };
}

export function SearchBar({ ref, button, loading = false, style, ...inputProps }: Props) {
  const colors = useSearchColors();
  // Utan Liquid Glass blir glaset en vanlig vy, som får en tunn kant.
  const fallback = !glassSupported && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator };

  return (
    <GlassContainer spacing={8} style={[styles.row, style]}>
      <GlassView style={[styles.field, fallback]} glassEffectStyle="regular">
        <SymbolView
          name="magnifyingglass"
          size={17}
          tintColor={colors.secondaryLabel}
          fallback={<Ionicons name="search" size={18} color={colors.secondaryLabel as string} />}
        />
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.label }]}
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          autoCorrect={false}
          {...inputProps}
        />
      </GlassView>

      {button && (
        <GlassView style={[styles.button, fallback]} glassEffectStyle="regular">
          <Pressable
            onPress={button.onPress}
            onPressIn={button.onPressIn}
            disabled={loading}
            style={({ pressed }) => [styles.buttonInner, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={button.accessibilityLabel ?? (button.icon === 'close' ? 'Close search' : 'Search')}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <SymbolView
                name={button.icon === 'close' ? 'xmark' : 'arrow.up'}
                size={17}
                weight="semibold"
                tintColor={colors.label}
                fallback={
                  <Ionicons
                    name={button.icon === 'close' ? 'close' : 'arrow-forward'}
                    size={20}
                    color={colors.label as string}
                  />
                }
              />
            )}
          </Pressable>
        </GlassView>
      )}
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
    height: SEARCH_BAR_HEIGHT,
    borderRadius: SEARCH_BAR_HEIGHT / 2,
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: 0 },
  button: { width: SEARCH_BAR_HEIGHT, height: SEARCH_BAR_HEIGHT, borderRadius: SEARCH_BAR_HEIGHT / 2 },
  buttonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
