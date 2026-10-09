import { useTheme } from '@/hooks/use-theme';
import type { AppTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Size = 'small' | 'medium' | 'large';
type Color = 'base' | 'indigo' | 'orange';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  size?: Size;
  color?: Color;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({
  label,
  onPress,
  icon,
  size = 'medium',
  color = 'indigo',
  accessibilityLabel,
  style,
}: Props) {
  const theme = useTheme();
  const sizing = sizeStyles[size];
  const colors = colorStyles[color](theme);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        sizing.button,
        style,
        {
          backgroundColor: colors.background,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={sizing.iconSize} color={colors.foreground} />}
      <Text style={[styles.text, sizing.text, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
  },
  text: {
    fontWeight: '600',
  },
});

const colorStyles: Record<Color, (theme: AppTheme) => {
  background: string;
  foreground: string;
}> = {
  base: (theme) => ({
    background: theme.backgroundElement,
    foreground: theme.text,
  }),
  indigo: (theme) => ({
    background: theme.accentIndigo,
    foreground: theme.accentText,
  }),
  orange: (theme) => ({
    background: theme.accentOrange,
    foreground: theme.accentText,
  }),
};

const sizeStyles = {
  small: {
    button: { paddingVertical: 6, paddingHorizontal: 10 },
    text: { fontSize: 13 },
    iconSize: 14,
  },
  medium: {
    button: { paddingVertical: 8, paddingHorizontal: 12 },
    text: { fontSize: 14 },
    iconSize: 16,
  },
  large: {
    button: { paddingVertical: 12, paddingHorizontal: 18 },
    text: { fontSize: 16 },
    iconSize: 20,
  },
} as const;
