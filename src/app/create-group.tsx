/**
 * create-group.tsx
 *
 * Sida för att skapa en grupp. Kan öppnas från vilken skärm som helst:
 *
 *   router.push('/create-group');
 *
 * Användaren väljer bild, namn och beskrivning, och väljer vänner att bjuda
 * in. Gruppen skapas via databasfunktionen create_group, som gör användaren
 * till ägare och skickar en inbjudan till varje vald vän. De inbjudna
 * accepterar eller nekar senare under gruppfliken.
 *
 * När gruppen är skapad laddas bilden upp och spellistan skapas i Spotify
 * (se syncPlaylists). Ett fel i något av de stegen stoppar inte skapandet,
 * eftersom gruppen då redan finns.
 *
 * Färger och mått kommer från temat, så sidan följer ljust och mörkt läge.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupFields } from '@/components/groups/group-fields';
import { GroupImagePicker } from '@/components/groups/group-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { SearchBar } from '@/components/ui/search-bar';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/errors';
import { getFriends, type Friendship } from '@/lib/friends';
import { pickGroupImage, uploadGroupAvatar, type GroupImage } from '@/lib/group-avatar';
import { syncPlaylists } from '@/lib/spotifyPlaylists';
import { supabase } from '@/lib/supabase';

const AVATAR = 44;
const CIRCLE = 32;

export default function CreateGroupScreen() {
  const theme = useTheme();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<GroupImage | null>(null);

  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<Friendship[]>([]);
  // Vännerna som ska bjudas in, med vännens profil-id som nyckel
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingFriends, setLoadingFriends] = useState(true);

  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hämtar vännerna (accepterade vänskaper)
  useEffect(() => {
    let active = true;
    getFriends()
      .then((list) => active && setFriends(list))
      .catch((error) => active && setErrorMessage(getErrorMessage(error)))
      .finally(() => active && setLoadingFriends(false));
    return () => {
      active = false;
    };
  }, []);

  // Vännerna som matchar sökningen. Listan är kort, så det sker direkt i appen.
  const visibleFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q === '' ? friends : friends.filter((f) => (f.display_name ?? '').toLowerCase().includes(q));
  }, [friends, search]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/groups');
  }

  function toggleFriend(friendId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  }

  async function handlePickImage() {
    try {
      const image = await pickGroupImage();
      if (image) setCoverImage(image);
    } catch (error) {
      Alert.alert('Could not use the picture', getErrorMessage(error));
    }
  }

  /**
   * Skapar gruppen och skickar inbjudningar till de valda vännerna.
   */
  async function handleCreate() {
    setCreating(true);
    setErrorMessage(null);
    try {
      const { data: groupId, error } = await supabase.rpc('create_group', {
        group_name: name,
        invitee_ids: [...selectedIds],
        group_description: description,
      });
      if (error) throw error;

      // Laddar upp gruppbilden. Gruppen är redan skapad, så ett fel här ska
      // inte stoppa resten. Gruppen får då ingen bild, men fungerar ändå.
      if (groupId && coverImage) {
        try {
          await uploadGroupAvatar(groupId, coverImage);
        } catch (imageError) {
          console.log('Kunde inte ladda upp gruppbilden:', imageError);
        }
      }

      // Skapar spellistan i Spotify. Gruppen är redan skapad, så ett fel här
      // ska inte stoppa något. Spellistan skapas då vid nästa synk (nattjobbet
      // skapar spellistor för grupper som saknar en).
      const sync = groupId ? await syncPlaylists(groupId) : null;
      const playlistOk = !!sync && sync.results.length > 0 && sync.results.every((r) => r.ok);

      // Sätter gruppbilden som omslag på spellistan i Spotify. Det kräver att
      // spellistan finns, så det görs bara om den skapades.
      if (playlistOk && coverImage && groupId) {
        const { error: coverError } = await supabase.functions.invoke('set-playlist-cover', {
          body: { groupId },
        });
        if (coverError) console.log('Kunde inte sätta omslaget i Spotify:', coverError);
      }

      if (!playlistOk) {
        Alert.alert(
          'Group created',
          'The Spotify playlist could not be created right now. It will be created automatically later.',
          [{ text: 'OK', onPress: goBack }]
        );
        return;
      }

      goBack();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  const canCreate = name.trim().length > 0 && !creating;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View>
            <ThemedText style={Typography.pageTitle}>Add group</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              And have a Larp-off
            </ThemedText>
          </View>

          <GroupImagePicker uri={coverImage?.uri ?? null} onPress={handlePickImage} />

          <GroupFields
            name={name}
            onChangeName={setName}
            description={description}
            onChangeDescription={setDescription}
          />

          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Invite friends{selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ''}
          </ThemedText>

          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search friends"
            autoCapitalize="none"
            button={
              search.length > 0
                ? { icon: 'close', onPress: () => setSearch(''), accessibilityLabel: 'Clear search' }
                : undefined
            }
          />

          {loadingFriends ? (
            <ActivityIndicator style={styles.spinner} />
          ) : friends.length === 0 ? (
            <ThemedText style={{ color: theme.textSecondary }}>
              You have no friends to invite yet. You can add people later.
            </ThemedText>
          ) : visibleFriends.length === 0 ? (
            <ThemedText style={{ color: theme.textSecondary }}>
              No friends match "{search.trim()}".
            </ThemedText>
          ) : (
            visibleFriends.map((friend) => {
              const selected = selectedIds.has(friend.friend_id);
              const friendName = friend.display_name ?? 'Unknown';

              return (
                <Pressable
                  key={friend.friend_id}
                  style={styles.friendRow}
                  onPress={() => toggleFriend(friend.friend_id)}
                  accessibilityRole="button"
                  accessibilityLabel={selected ? `Remove ${friendName} from invites` : `Invite ${friendName}`}
                >
                  {friend.avatar_url ? (
                    <Image source={{ uri: friend.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]} />
                  )}
                  <ThemedText style={styles.friendName} numberOfLines={1}>
                    {friendName}
                  </ThemedText>
                  <View
                    style={[
                      styles.circle,
                      { backgroundColor: selected ? theme.backgroundSelected : theme.accentIndigo },
                    ]}
                  >
                    <SymbolView
                      name={selected ? 'checkmark' : 'plus'}
                      size={14}
                      weight="bold"
                      tintColor={selected ? theme.textSecondary : theme.accentText}
                      fallback={
                        <Ionicons
                          name={selected ? 'checkmark' : 'add'}
                          size={18}
                          color={selected ? theme.textSecondary : theme.accentText}
                        />
                      }
                    />
                  </View>
                </Pressable>
              );
            })
          )}

          {errorMessage && (
            <ThemedText style={{ color: theme.destructiveText }}>{errorMessage}</ThemedText>
          )}

          <ActionButton
            label={creating ? 'Creating...' : 'Confirm'}
            icon="checkmark"
            size="large"
            color="indigo"
            disabled={!canCreate}
            onPress={handleCreate}
            style={styles.confirm}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.seven,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  subtitle: { fontSize: 18, lineHeight: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginTop: Spacing.two },
  spinner: { marginTop: Spacing.three },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  friendName: { flex: 1, fontSize: 16 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  confirm: { alignSelf: 'center', marginTop: Spacing.three },
});