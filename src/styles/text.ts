import { StyleSheet } from 'react-native';

import type { AppTheme } from '@/constants/theme';

export function createTextStyles(theme: AppTheme) {
  return StyleSheet.create({
    pageTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: theme.text,
    },
    pageSubtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 2,
    },
    body: {
      fontSize: 16,
      color: theme.text,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    secondary: {
      color: theme.textSecondary,
    },
    button: {
      color: theme.text,
      fontWeight: '600',
    },
  });
}
