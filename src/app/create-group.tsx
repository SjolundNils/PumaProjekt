/**
 * create-group.tsx
 *
 * Sida för att skapa en grupp. Kan öppnas från vilken skärm som helst:
 *
 *   router.push('/create-group');
 *
 * Användaren väljer ett namn och söker bland sina vänner för att bjuda in
 * dem. Gruppen skapas via databasfunktionen create_group, som gör
 * användaren till ägare och skickar en inbjudan till varje vald vän.
 * De inbjudna accepterar eller nekar senare under gruppfliken.
 *
 * Valet av gruppbild är en platshållare som inte gör något än.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** Max antal tecken i gruppnamnet. */
const MAX_NAME_LENGTH = 40;

type Friend = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function CreateGroupScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadFriends();
  }, []);

  /**
   * Hämtar användarens vänner (accepterade vänskaper).
   *
   * En vänskap har två personer, requester och addressee. Den av dem som
   * inte är användaren själv är vännen.
   */
  async function loadFriends() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('friendships')
        .select(`
          requester:profiles!friendships_requester_id_fkey ( id, display_name, avatar_url ),
          addressee:profiles!friendships_addressee_id_fkey ( id, display_name, avatar_url )
        `)
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      if (error) throw error;

      const list = data
        .map((row) => (row.requester?.id === userId ? row.addressee : row.requester))
        .filter((friend): friend is Friend => friend !== null);

      setFriends(list);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoadingFriends(false);
    }
  }

  // Sökresultat: vänner som matchar söktexten och inte redan är valda.
  // Vänlistan är kort, så sökningen sker direkt i appen.
  const query = search.trim().toLowerCase();
  const results = friends.filter(
    (friend) =>
      !selected.some((s) => s.id === friend.id) &&
      (query === '' || (friend.display_name ?? '').toLowerCase().includes(query))
  );

  function addFriend(friend: Friend) {
    setSelected((current) => [...current, friend]);
    setSearch('');
  }

  function removeFriend(id: string) {
    setSelected((current) => current.filter((friend) => friend.id !== id));
  }

  /**
   * Skapar gruppen och skickar inbjudningar till de valda vännerna.
   */
  async function handleCreate() {
    setCreating(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.rpc('create_group', {
        group_name: name,
        invitee_ids: selected.map((friend) => friend.id),
      });
      if (error) throw error;

      router.back();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  const canCreate = name.trim().length > 0 && !creating;
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.text }];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Gruppbild. Platshållare tills funktionen för bilder byggs. */}
        <Pressable
          style={[styles.avatar, { borderColor: colors.text }]}
          onPress={() => Alert.alert('Coming soon', 'Group pictures are not available yet.')}
          accessibilityLabel="Choose group picture"
        >
          <Ionicons name="camera-outline" size={32} color={colors.text} />
        </Pressable>

        <ThemedText style={styles.label}>Name</ThemedText>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          placeholder="Group name"
          placeholderTextColor="#888"
          maxLength={MAX_NAME_LENGTH}
        />

        <ThemedText style={styles.label}>Invite friends</ThemedText>

        {/* Valda vänner. Tryck på en för att ta bort hen. */}
        {selected.length > 0 && (
          <View style={styles.chips}>
            {selected.map((friend) => (
              <Pressable
                key={friend.id}
                style={styles.chip}
                onPress={() => removeFriend(friend.id)}
                accessibilityLabel={`Remove ${friend.display_name ?? 'friend'}`}
              >
                <ThemedText style={styles.chipText}>{friend.display_name ?? 'Unknown'}</ThemedText>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={inputStyle}
          value={search}
          onChangeText={setSearch}
          placeholder="Search friends"
          placeholderTextColor="#888"
          autoCorrect={false}
        />

        {loadingFriends ? (
          <ActivityIndicator style={styles.spacing} />
        ) : friends.length === 0 ? (
          <ThemedText style={styles.dim}>You have no friends to invite yet.</ThemedText>
        ) : (
          results.map((friend) => (
            <Pressable key={friend.id} style={styles.friendRow} onPress={() => addFriend(friend)}>
              {friend.avatar_url ? (
                <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatar} />
              ) : (
                <View style={[styles.friendAvatar, styles.avatarPlaceholder]} />
              )}
              <ThemedText style={styles.friendName}>{friend.display_name ?? 'Unknown'}</ThemedText>
              <Ionicons name="add-circle-outline" size={24} color="#1DB954" />
            </Pressable>
          ))
        )}

        {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

        <Pressable
          style={[styles.button, !canCreate && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          <ThemedText style={styles.buttonText}>
            {creating ? 'Creating...' : 'Create group'}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, gap: 12, paddingBottom: 48 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    opacity: 0.6,
  },
  label: { fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, opacity: 0.9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1DB954',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  friendAvatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { backgroundColor: '#ccc' },
  friendName: { flex: 1 },
  dim: { opacity: 0.6 },
  spacing: { marginVertical: 12 },
  error: { color: '#c0392b' },
  button: { backgroundColor: '#1DB954', paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600' },
});