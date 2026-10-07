/**
 * index.tsx
 *
 * Flödet. Appens startsida efter inloggning.
 *
 * Visar händelser från vänner och gruppkompisar, till exempel valda
 * dagens låtar och betyg på användarens egna låtar. Vilka händelser som
 * visas bestäms av databasens RLS-policy (se lib/feed.ts).
 *
 * Flödet hämtas på nytt varje gång fliken visas, och användaren kan dra
 * nedåt för att uppdatera manuellt.
 */

import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedItem } from '@/components/feed/feed-item';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';
import { fetchFeed, type FeedEvent } from '@/lib/feed';

export default function FeedScreen() {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  // Sant vid första laddningen, då visas en laddningsindikator mitt på skärmen.
  const [loading, setLoading] = useState(true);

  // Sant när användaren drar nedåt för att uppdatera.
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Hämtar flödet och ersätter listan.
   */
  const loadFeed = useCallback(async () => {
    try {
      const data = await fetchFeed();
      setEvents(data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Hämtar flödet varje gång fliken visas, så att nya händelser syns
  // när användaren kommer tillbaka från en annan flik.
  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  /** Anropas när användaren drar nedåt i listan. */
  async function handleRefresh() {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          data={events}
          keyExtractor={(event) => event.id.toString()}
          renderItem={({ item }) => <FeedItem event={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title">Flöde</ThemedText>

              {/* TEST: tillfälliga länkar till testskärmarna. Tas bort senare. */}
              <View style={styles.testLinks}>
                <Link href="/login">
                  <ThemedText type="link">Inloggning</ThemedText>
                </Link>
                <Link href="/search-test">
                  <ThemedText type="link">Söktest</ThemedText>
                </Link>
                <Link href="/profile-test">
                  <ThemedText type="link">Profiltest</ThemedText>
                </Link>
                <Link href="/groups-test">
                  <ThemedText type="link">Groupstest</ThemedText>
                </Link>
              </View>

              {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}
            </View>
          }
          ListEmptyComponent={
            !errorMessage ? (
              <ThemedText style={styles.empty}>
                Inget har hänt än. När dina vänner väljer dagens låt dyker den upp här.
              </ThemedText>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: BottomTabInset + 16 },
  header: { gap: 12, paddingTop: 8, paddingBottom: 8 },
  testLinks: { flexDirection: 'row', gap: 16 },
  error: { color: '#c0392b' },
  empty: { textAlign: 'center', opacity: 0.6, marginTop: 48 },
});