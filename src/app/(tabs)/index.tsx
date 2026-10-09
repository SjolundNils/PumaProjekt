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
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedItem } from '@/components/feed/feed-item';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';


import { fetchFeed, type FeedEvent } from '@/lib/feed';
import { fetchMyRatings } from '@/lib/ratings';

export default function FeedScreen() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [testRating, setTestRating] = useState(0);
  // Sant vid första laddningen, då visas en laddningsindikator mitt på skärmen.
  const [loading, setLoading] = useState(true);

  // Sant när användaren drar nedåt för att uppdatera.
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [myRatings, setMyRatings] = useState<Record<number, number>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  /**
   * Hämtar flödet och ersätter listan.
   */
  const loadFeed = useCallback(async () => {

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setCurrentUserId(sessionData.session?.user.id ?? null);

      const data = await fetchFeed();

      // Hämtar användarens betyg för alla låtar som finns i flödet.
      const songIds = [...new Set(data.flatMap((event) => (event.song ? [event.song.id] : [])))];
      const ratings = await fetchMyRatings(songIds);

      setEvents(data);
      setMyRatings(ratings);
      setErrorMessage(null);
    } catch (error) {
      console.log('Flödesfel:', error);
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
          renderItem={({ item }) => <FeedItem
            event={item}
            currentUserId={currentUserId}
            myRating={item.song ? myRatings[item.song.id] : undefined}
          />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title">Flöde</ThemedText>

              {/* TEST: tillfälliga länkar till testskärmarna. Tas bort senare. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.testLinks}
              >
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
                <Link href="/friends-test">
                  <ThemedText type="link">Friendstest</ThemedText>
                </Link>
                <Link href="/rate/85">
                  <ThemedText type="link">Rate test</ThemedText>
                </Link>
              </ScrollView>
              <Link href="/create-group">
                <ThemedText type="link">Create group</ThemedText>
              </Link>

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