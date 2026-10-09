import { StyleSheet } from 'react-native';

import type { Colors } from '@/constants/theme';

export function createFriendsStyles(theme: (typeof Colors)['light'] | (typeof Colors)['dark']) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background, paddingHorizontal: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16 },
  title: { fontSize: 32, fontWeight: '800', color: theme.text },
  subtitle: { fontSize: 16, color: theme.textSecondary, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.background,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
    marginTop: 24,
    marginBottom: 12,
    shadowColor: theme.text,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 16, color: theme.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarEmpty: { backgroundColor: theme.backgroundElement },
  name: { flex: 1, fontSize: 16, color: theme.text },
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { color: theme.textSecondary, textAlign: 'center' },
  retryButton: { marginTop: 12, backgroundColor: theme.backgroundElement, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: theme.text, fontWeight: '600' },
  });
}
