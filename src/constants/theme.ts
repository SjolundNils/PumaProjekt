/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F6F6F6',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
	baseText: '#6155F5',

    accentIndigo: '#6155F5',
    accentOrange: '#FF8D28',
    accentOrangeButtonBackground: '#FF8D28',
    accentOrangeButtonBorder: 'transparent',
    accentOrangeButtonText: '#FFFFFF',
    accentText: '#FFFFFF',
    destructiveBackground: '#FFE3E4',
    destructiveBorder: '#FF383C',
    destructiveText: '#FF383C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
	baseText: '#ffffff',

    accentIndigo: '#6155F5',
    accentOrange: '#FF8D28',
    accentOrangeButtonBackground: 'transparent',
    accentOrangeButtonBorder: '#FF8D28',
    accentOrangeButtonText: '#FF8D28',
    accentText: '#FFFFFF',
    destructiveBackground: '#3A1E22',
    destructiveBorder: '#FF6961',
    destructiveText: '#FF6961',
  },
} as const;

export type AppTheme = (typeof Colors)['light'] | (typeof Colors)['dark'];
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  twoAndHalf: 12,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  seven: 128,
} as const;

export const Typography = {
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  pageTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
} as const;

export const Radius = {
  small: 4,
  medium: 12,
  large: 20,
  pill: 999,
} as const;

export const ComponentSize = {
  avatar: {
    default: 40,
    small: 20,
  },
  cover: 52,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
