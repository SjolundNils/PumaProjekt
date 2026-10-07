import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
    acceptRequest,
    Friendship,
    listFriendships,
    ProfileHit,
    removeFriendship,
    searchUsers,
    sendFriendRequest,
} from '@/lib/friends';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACCENT = '#5B4DF5';

export default function AddFriendsScreen() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | string | null>(null);

  const incoming = friendships.filter(
    (friendship) => friendship.status === 'pending' && friendship.direction === 'incoming',
  );
  const outgoing = friendships.filter(
    (friendship) => friendship.status === 'pending' && friendship.direction === 'outgoing',
  );

  const loadRequests = useCallback(async () => {
    try {
      setFriendships(await listFriendships());
    } catch (error) {
      Alert.alert('Could not load requests', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleSearch() {
    if (query.trim().length < 2 || searching) return;

    setSearching(true);
    try {
      setHits(await searchUsers(query));
      setSearched(true);
    } catch (error) {
      Alert.alert('Search failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSearching(false);
    }
  }

  async function handleRequestAction(
    id: number | string,
    action: () => Promise<unknown>,
  ) {
    setBusyId(id);
    try {
      await action();
      await loadRequests();
      if (query.trim().length >= 2) {
        setHits(await searchUsers(query));
      }
    } catch (error) {
      Alert.alert('Could not update request', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  function renderProfile(profile: ProfileHit) {
    const actionLabel =
      profile.relation === 'none'
        ? 'Add'
        : profile.relation === 'sent'
          ? 'Request sent'
          : profile.relation === 'friends'
            ? 'Friends'
            : 'Accept';

    return (
      <ProfileRow name={profile.display_name} avatar={profile.avatar_url}>
        {profile.relation === 'none' && (
          <SmallButton
            label={actionLabel}
            disabled={busyId === profile.id}
            onPress={() => handleRequestAction(profile.id, () => sendFriendRequest(profile.id))}
          />
        )}
        {profile.relation !== 'none' && (
          <ThemedText type="small">{actionLabel}</ThemedText>
        )}
      </ProfileRow>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#000" />
        </Pressable>

        <Text style={styles.title}>Add friends</Text>
        <Text style={styles.subtitle}>Search for likeminded</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Ionicons name="search" size={20} color="#000" />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (!text.trim()) {
                  setHits([]);
                  setSearched(false);
                }
              }}
              onSubmitEditing={handleSearch}
              placeholder="Search users"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <Pressable style={styles.searchButton} onPress={handleSearch} disabled={searching}>
            {searching ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-forward" size={20} color="#fff" />}
          </Pressable>
        </View>

        {searched && hits.length === 0 && (
          <Text style={styles.empty}>No users found.</Text>
        )}
        {hits.map((profile) => (
          <View key={profile.id}>{renderProfile(profile)}</View>
        ))}

        <FlatList
          data={incoming}
          keyExtractor={(item) => `incoming-${item.friendship_id}`}
          ListHeaderComponent={
            <Text style={styles.section}>
              Pending requests from others
            </Text>
          }
          ListEmptyComponent={!loading ? <Text style={styles.empty}>None.</Text> : null}
          renderItem={({ item }) => (
            <ProfileRow name={item.display_name} avatar={item.avatar_url}>
              <View style={styles.actions}>
                <SmallButton
                  label="Accept"
                  disabled={busyId === item.friendship_id}
                  onPress={() => handleRequestAction(item.friendship_id, () => acceptRequest(item.friendship_id))}
                />
                <SmallButton
                  label="Decline"
                  disabled={busyId === item.friendship_id}
                  onPress={() => handleRequestAction(item.friendship_id, () => removeFriendship(item.friendship_id))}
                />
              </View>
            </ProfileRow>
          )}
          ListFooterComponent={
            <View>
              <Text style={styles.section}>
                Pending requests from you
              </Text>
              {outgoing.length === 0 ? (
                <Text style={styles.empty}>None.</Text>
              ) : (
                outgoing.map((item) => (
                  <ProfileRow key={item.friendship_id} name={item.display_name} avatar={item.avatar_url}>
                    <SmallButton
                      label="Cancel"
                      disabled={busyId === item.friendship_id}
                      onPress={() => handleRequestAction(item.friendship_id, () => removeFriendship(item.friendship_id))}
                    />
                  </ProfileRow>
                ))
              )}
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function ProfileRow({
  name,
  avatar,
  children,
}: {
  name: string | null;
  avatar: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty]} />}
      <Text style={styles.name} numberOfLines={1}>{name ?? 'Unknown'}</Text>
      {children}
    </View>
  );
}

function SmallButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.smallButton, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  safeArea: { flex: 1, paddingHorizontal: 16 },
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
  title: { fontSize: 32, fontWeight: '800', color: '#000', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#999', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  input: { flex: 1, fontSize: 16, color: '#000' },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: ACCENT,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: '#888', paddingVertical: 12 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  listContent: { paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarEmpty: { backgroundColor: '#ddd' },
  name: { flex: 1, fontSize: 16, color: '#000' },
  actions: { flexDirection: 'row', gap: 6 },
  smallButton: { backgroundColor: ACCENT, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.5 },
});