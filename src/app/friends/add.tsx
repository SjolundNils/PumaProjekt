import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { BackButton } from '@/components/ui/back-button';
import { useTheme } from '@/hooks/use-theme';
import {
  acceptRequest,
  Friendship,
  listFriendships,
  ProfileHit,
  removeFriendship,
  searchUsers,
  sendFriendRequest,
} from '@/lib/friends';
import { openUserProfile } from '@/lib/profile';
import { createFriendsStyles } from '@/styles/friends';
import { createTextStyles } from '@/styles/text';
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

export default function AddFriendsScreen() {
  const theme = useTheme();
  const styles = createAddFriendsStyles(theme);
  const textStyles = createTextStyles(theme);
  const friendsStyles = createFriendsStyles(theme);
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
      <ProfileRow name={profile.display_name} avatar={profile.avatar_url} styles={friendsStyles} textStyles={textStyles}   onPress={() => openUserProfile(profile.id)}>
        {profile.relation === 'none' && (
          <ActionButton
            label={actionLabel}
            size="small"
            color="indigo"
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
      <BackButton onPress={() => router.back()} />

      <Text style={[textStyles.pageTitle, styles.title]}>Add friends</Text>
      <Text style={textStyles.pageSubtitle}>Search for likeminded</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Ionicons name="search" size={20} color={theme.text} />
            <TextInput
              style={[styles.input, textStyles.body]}
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
            {searching ? <ActivityIndicator color={theme.accentText} /> : <Ionicons name="arrow-forward" size={20} color={theme.accentText} />}
          </Pressable>
        </View>

        {searched && hits.length === 0 && (
          <Text style={[textStyles.secondary, styles.empty]}>No users found.</Text>
        )}
        {hits.map((profile) => (
          <View key={profile.id}>{renderProfile(profile)}</View>
        ))}

        <FlatList
          data={incoming}
          keyExtractor={(item) => `incoming-${item.friendship_id}`}
          ListHeaderComponent={
            <Text style={[textStyles.sectionTitle, styles.section]}>
              Pending requests from others
            </Text>
          }
          ListEmptyComponent={!loading ? <Text style={[textStyles.secondary, styles.empty]}>None.</Text> : null}
          renderItem={({ item }) => (
            <ProfileRow name={item.display_name} avatar={item.avatar_url} styles={friendsStyles} textStyles={textStyles} onPress={() => openUserProfile(item.friend_id)}>
              <View style={styles.actions}>
                <ActionButton
                  label="Accept"
                  size="small"
                  color="indigo"
                  disabled={busyId === item.friendship_id}
                  onPress={() => handleRequestAction(item.friendship_id, () => acceptRequest(item.friendship_id))}
                />
                <ActionButton
                  label="Decline"
                  size="small"
                  color="destructiveSecondary"
                  disabled={busyId === item.friendship_id}
                  onPress={() => handleRequestAction(item.friendship_id, () => removeFriendship(item.friendship_id))}
                />
              </View>
            </ProfileRow>
          )}
          ListFooterComponent={
            <View>
              <Text style={[textStyles.sectionTitle, styles.section]}>
                Pending requests from you
              </Text>
              {outgoing.length === 0 ? (
                <Text style={[textStyles.secondary, styles.empty]}>None.</Text>
              ) : (
                outgoing.map((item) => (
                  <ProfileRow key={item.friendship_id} name={item.display_name} avatar={item.avatar_url} styles={friendsStyles} textStyles={textStyles} onPress={() => openUserProfile(item.friend_id)}>
                    <ActionButton
                      label="Cancel"
                      size="small"
                      color="destructiveSecondary"
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
  styles,
  textStyles,
  onPress,
}: {
  name: string | null;
  avatar: string | null;
  children: React.ReactNode;
  styles: ReturnType<typeof createFriendsStyles>;
  textStyles: ReturnType<typeof createTextStyles>;
  /** Anropas när raden trycks. Utan den går raden inte att trycka på. */
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty]} />}
      <Text style={[styles.name, textStyles.body]} numberOfLines={1}>{name ?? 'Unknown'}</Text>
      {children}
    </Pressable>
  );
}

function createAddFriendsStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  safeArea: { flex: 1, paddingHorizontal: 16 },
  title: { marginTop: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    backgroundColor: theme.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: theme.text,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  input: { flex: 1 },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: theme.accentIndigo,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { paddingVertical: 12 },
  section: { marginTop: 20, marginBottom: 8 },
  listContent: { paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  actions: { flexDirection: 'row', gap: 6 },
  });
}