/**
 * add-song.tsx
 *
 * Fliken Dagens låt. Ska låta användaren söka efter och välja dagens låt.
 *
 * Tom sida tills vidare. Själva funktionen för att välja låt byggs som en
 * egen komponent i src/components och läggs in här.
 */
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AddSongScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Dagens låt</ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 16 },
});