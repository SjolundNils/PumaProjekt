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
import { BottomTabInset, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/errors';
import { fetchFeed, type FeedEvent } from '@/lib/feed';
import { fetchMyRatings } from '@/lib/ratings';
import { supabase } from '@/lib/supabase';
import { createTextStyles } from '@/styles/text';

export default function FeedScreen() {
  const theme = useTheme();
  const textStyles = createTextStyles(theme);
  const styles = createFeedStyles(theme);
  const [events, setEvents] = useState<FeedEvent[]>([]);
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
              <View style={styles.titleGroup}>
                <ThemedText style={textStyles.pageTitle}>Niche to meet you</ThemedText>
                <ThemedText style={[textStyles.pageSubtitle, styles.subtitle]}>
                  We’re sure todays track will be the most indie one yet
                </ThemedText>
              </View>

              {/* TEST: tillfälliga länkar till testskärmarna. Tas bort senare. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.testLinks}
              >
                <Link href="/groups-test">
                  <ThemedText themeColor="accentIndigo" type="link">Groupstest</ThemedText>
                </Link>
                <Link href="/create-group">
                  <ThemedText themeColor="accentIndigo" type="link">Create group</ThemedText>
                </Link>

              </ScrollView>


              {errorMessage && (
                <ThemedText style={[textStyles.secondary, styles.error]}>{errorMessage}</ThemedText>
              )}
            </View>
          }
          ListEmptyComponent={
            !errorMessage ? (
              <ThemedText style={[textStyles.secondary, styles.empty]}>
                Inget har hänt än. När dina vänner väljer dagens låt dyker den upp här.
              </ThemedText>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function createFeedStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: {
      paddingHorizontal: Spacing.three,
      paddingBottom: BottomTabInset + Spacing.three,
    },
    header: {
      gap: Spacing.twoAndHalf,
      paddingTop: Spacing.seven,
      paddingBottom: Spacing.two,
    },
    titleGroup: { gap: Spacing.half },
    subtitle: { maxWidth: '60%' },
    testLinks: { flexDirection: 'row', gap: Spacing.four },
    error: { color: theme.destructiveText },
    empty: {
      ...Typography.body,
      textAlign: 'center',
      opacity: 0.6,
      marginTop: Spacing.six - Spacing.two,
    },
  });
}