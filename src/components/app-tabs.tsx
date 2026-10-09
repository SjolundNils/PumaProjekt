/**
 * app-tabs.tsx
 *
 * Appens flikrad. Använder Expo Routers native tabs, som renderar iOS
 * inbyggda flikrad. Det ger systemets utseende, inklusive Liquid Glass.
 *
 * Varje NativeTabs.Trigger motsvarar en fil i src/app/(tabs). Attributet
 * name måste vara exakt filnamnet utan .tsx. Ordningen här bestämmer
 * ordningen i flikraden.
 *
 * Ikonerna är Apples SF Symbols (attributet sf), som följer systemets stil
 * och färger automatiskt.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  // Väljer färgschema efter telefonens ljusa eller mörka läge.
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      iconColor={{ default: colors.textSecondary, selected: colors.accentIndigo }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.accentIndigo } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Flöde</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="groups">
        <NativeTabs.Trigger.Label>Grupper</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.3.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="add-song" role="search">
        <NativeTabs.Trigger.Label>Dagens låt</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus" />
      </NativeTabs.Trigger>

    </NativeTabs>
  );
}