/**
 * friends/index.tsx
 *
 * Vänlistan: visar mina vänner, låter mig söka bland dem och ta bort vänner,
 * och länkar vidare till sidan för att lägga till vänner (friends/add.tsx).
 *
 * Datan kommer från lib/friends.ts. Sökningen här filtrerar bara listan jag
 * redan har hämtat. Sökning bland alla användare görs på add-sidan.
 */
import { Friendship, getFriends, removeFriendship } from '@/lib/friends';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// TODO: flytta till constants/ när ni har en gemensam färgfil
const ACCENT = '#5B4DF5';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<Friendship[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Hämtar vännerna och sorterar dem alfabetiskt. */
  const load = useCallback(async () => {
    try {
      const data = await getFriends();
      data.sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? '', 'sv'));
      setFriends(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Hämtar om varje gång sidan blir synlig, så att nya vänner syns när man
  // kommer tillbaka från add-sidan.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Vännerna som matchar sökrutan (ingen sökning = alla). */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => (f.display_name ?? '').toLowerCase().includes(q));
  }, [friends, query]);

  /** "..."-menyn. Än så länge finns bara ett val, men fler kan läggas till. */
  function openMenu(friend: Friendship) {
    Alert.alert(friend.display_name ?? 'Friend', undefined, [
      {
        text: 'Remove friend',
        style: 'destructive',
        onPress: () => removeFriend(friend),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function removeFriend(friend: Friendship) {
    try {
      await removeFriendship(friend.friendship_id);
      // Tar bort direkt i listan, utan att vänta på en ny hämtning
      setFriends((prev) => prev.filter((f) => f.friendship_id !== friend.friendship_id));
    } catch (e) {
      Alert.alert('Could not remove friend', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      {/* Egen header i designen, så den inbyggda döljs */}
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable style={styles.backButton} onPress={goBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#000" />
      </Pressable>

      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>Your music lovers</Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => router.push('/friends/add')}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addButtonText}>Add Friends</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#000" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              load();
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(f) => String(f.friendship_id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]} />
              )}
              <Text style={styles.name} numberOfLines={1}>
                {item.display_name ?? 'Unknown'}
              </Text>
              <Pressable style={styles.menuButton} onPress={() => openMenu(item)} hitSlop={8}>
                <Ionicons name="ellipsis-horizontal" size={16} color={ACCENT} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              {query.trim() ? (
                <Text style={styles.emptyText}>No friends match "{query.trim()}"</Text>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptyText}>Tap "Add Friends" to find people.</Text>
                </>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16 },
  title: { fontSize: 32, fontWeight: '800', color: '#000' },
  subtitle: { fontSize: 16, color: '#999', marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
    marginTop: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarEmpty: { backgroundColor: '#ddd' },
  name: { flex: 1, fontSize: 16, color: '#000' },
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#888', textAlign: 'center' },
  retryButton: { marginTop: 12, backgroundColor: ACCENT, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: '#fff', fontWeight: '600' },
});