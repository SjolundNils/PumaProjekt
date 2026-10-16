import { StyleSheet } from 'react-native';

import { Typography, type AppTheme } from '@/constants/theme';

export function createTextStyles(theme: AppTheme) {
  return StyleSheet.create({
    pageTitle: {
      ...Typography.pageTitle,
      color: theme.text,
    },
    pageSubtitle: {
      ...Typography.body,
      lineHeight: 20,
      color: theme.textSecondary,
      marginTop: 2,
    },
    body: {
      ...Typography.body,
      color: theme.text,
    },
    sectionTitle: {
      ...Typography.sectionTitle,
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
