/**
 * members.tsx
 *
 * Medlemmarna i en grupp, och en vy för att bjuda in fler.
 *
 * Medlemsvyn visar ägaren (med krona) först. Ett tryck på en rad öppnar
 * profilen. De tre prickarna öppnar en ruta med Remove member (bara för
 * ägaren), Show profile och Cancel.
 *
 * Add members-vyn söker bland användarens vänner som inte redan är med i
 * gruppen. Bara vänner kan bjudas in (databasfunktionen invite_to_group
 * kontrollerar det). Efter en inbjudan visas en bock i stället för plus.
 *
 * Att ta bort en medlem går via databasfunktionen remove_group_member, som
 * kontrollerar att anroparen är gruppens ägare.
 *
 * Färger och mått kommer från temat, så sidan följer ljust och mörkt läge.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	Image,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
	type AlertButton,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackButton } from '@/components/ui/back-button';
import { SearchBar } from '@/components/ui/search-bar';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/errors';
import { getFriends, type Friendship } from '@/lib/friends';
import { openUserProfile } from '@/lib/profile';
import { syncPlaylists } from '@/lib/spotifyPlaylists';
import { supabase } from '@/lib/supabase';

type Member = {
  user_id: string;
  joined_at: string | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Group = {
  name: string;
  avatar_url: string | null;
  owner_id: string;
};

const AVATAR = 44;
const COVER = 64;
const CIRCLE = 32;

/** Profilbild, eller en grå cirkel om den saknas. */
function Avatar({ uri, color }: { uri: string | null | undefined; color: string }) {
  const style = { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 };
  return uri ? (
    <Image source={{ uri }} style={style} />
  ) : (
    <View style={[style, { backgroundColor: color }]} />
  );
}

export default function GroupMembersScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add members-vyn
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  // Vänner som har fått en inbjudan under den här sessionen (visas med bock)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  /** Hämtar gruppen och medlemmarna. */
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setCurrentUserId(sessionData.session?.user.id ?? null);

      const [groupResult, membersResult] = await Promise.all([
        supabase.from('groups').select('name, avatar_url, owner_id').eq('id', id).maybeSingle(),
        supabase
          .from('group_members')
          .select('user_id, joined_at, profiles!group_members_user_id_fkey(display_name, avatar_url)')
          .eq('group_id', id),
      ]);
      if (groupResult.error) throw groupResult.error;
      if (membersResult.error) throw membersResult.error;
      if (!groupResult.data) throw new Error("You don't have access to this group.");

      setGroup(groupResult.data);
      setMembers(membersResult.data as unknown as Member[]);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Hämtas varje gång sidan visas, till exempel när man kommer tillbaka från en profil
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Ägaren först, sedan i den ordning folk gick med
  const orderedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.user_id === group?.owner_id) return -1;
        if (b.user_id === group?.owner_id) return 1;
        return (a.joined_at ?? '').localeCompare(b.joined_at ?? '');
      }),
    [members, group?.owner_id]
  );

  const isOwner = !!currentUserId && group?.owner_id === currentUserId;

  // Vänner som kan bjudas in: inte redan medlemmar, och som matchar sökningen
  const candidates = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.user_id));
    const q = query.trim().toLowerCase();
    return friends.filter(
      (f) => !memberIds.has(f.friend_id) && (q === '' || (f.display_name ?? '').toLowerCase().includes(q))
    );
  }, [friends, members, query]);

  function goBack() {
    // I Add members går tillbaka till medlemslistan
    if (adding) {
      setAdding(false);
      setQuery('');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/groups');
  }

  /** Öppnar en profil. Din egen går till profilfliken. */
  function showProfile(userId: string) {
    if (userId === currentUserId) router.navigate('/profile');
    else openUserProfile(userId);
  }

  async function openAdd() {
    setQuery('');
    setAdding(true);
    setLoadingFriends(true);
    try {
      setFriends(await getFriends());
    } catch (error) {
      Alert.alert('Could not load friends', getErrorMessage(error));
    } finally {
      setLoadingFriends(false);
    }
  }

  async function invite(friend: Friendship) {
    if (!id || invitingId) return;
    setInvitingId(friend.friend_id);
    try {
      const { error } = await supabase.rpc('invite_to_group', {
        p_group_id: id,
        p_user_id: friend.friend_id,
      });
      if (error) throw error;
      setInvitedIds((previous) => new Set(previous).add(friend.friend_id));
    } catch (error) {
      Alert.alert('Invitation failed', getErrorMessage(error));
    } finally {
      setInvitingId(null);
    }
  }

  async function removeMember(member: Member) {
    if (!id) return;
    try {
      const { error } = await supabase.rpc('remove_group_member', {
        p_group_id: id,
        p_user_id: member.user_id,
      });
      if (error) throw error;

      setMembers((previous) => previous.filter((m) => m.user_id !== member.user_id));
      // Personens låt tas bort ur spellistan. Misslyckas det hinner nattjobbet ikapp.
      syncPlaylists(id).catch(() => {});
    } catch (error) {
      Alert.alert('Could not remove member', getErrorMessage(error));
    }
  }

  /** Rutan som öppnas med de tre prickarna. */
  function openMenu(member: Member) {
    const name = member.profiles?.display_name ?? 'Member';
    const canRemove = isOwner && member.user_id !== group?.owner_id;

    const buttons: AlertButton[] = [];
    if (canRemove) {
      buttons.push({ text: 'Remove member', style: 'destructive', onPress: () => removeMember(member) });
    }
    buttons.push({ text: 'Show profile', onPress: () => showProfile(member.user_id) });
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(name, undefined, buttons);
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  // Ingen åtkomst (till exempel en inbjuden som inte gått med än)
  if (!group) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.screen} edges={['top']}>
          <View style={styles.content}>
            <BackButton onPress={goBack} />
            <ThemedText style={{ color: theme.textSecondary }}>
              {errorMessage ?? "You don't have access to this group."}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const memberLabel = `${members.length} ${members.length === 1 ? 'member' : 'members'}`;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton onPress={goBack} />

          {/* Gruppens omslag, namn och undertitel */}
          <View style={styles.titleRow}>
            {group.avatar_url ? (
              <Image source={{ uri: group.avatar_url }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, { backgroundColor: theme.backgroundSelected }]} />
            )}
            <View style={styles.titleText}>
              <ThemedText style={Typography.pageTitle} numberOfLines={1}>
                {group.name}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                {adding ? 'Share with friends' : memberLabel}
              </ThemedText>
            </View>

            {!adding && (
              <Pressable
                onPress={openAdd}
                style={[styles.circle, { backgroundColor: theme.accentIndigo }]}
                accessibilityRole="button"
                accessibilityLabel="Add members"
              >
                <SymbolView
                  name="plus"
                  size={16}
                  weight="bold"
                  tintColor={theme.accentText}
                  fallback={<Ionicons name="add" size={20} color={theme.accentText} />}
                />
              </Pressable>
            )}
          </View>

          {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

          {adding ? (
            <>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                onClose={() => setQuery('')}
                placeholder="Search friends"
                autoFocus
              />

              {loadingFriends ? (
                <ActivityIndicator style={styles.spinner} />
              ) : candidates.length === 0 ? (
                <ThemedText style={{ color: theme.textSecondary }}>
                  {friends.length === 0
                    ? 'You have no friends to invite yet.'
                    : query.trim()
                      ? `No friends match "${query.trim()}".`
                      : 'All your friends are already in this group.'}
                </ThemedText>
              ) : (
                candidates.map((friend) => {
                  const invited = invitedIds.has(friend.friend_id);
                  const busy = invitingId === friend.friend_id;

                  return (
                    <View key={friend.friend_id} style={styles.row}>
                      <Avatar uri={friend.avatar_url} color={theme.backgroundSelected} />
                      <ThemedText style={styles.name} numberOfLines={1}>
                        {friend.display_name ?? 'Unknown'}
                      </ThemedText>
                      <Pressable
                        onPress={() => invite(friend)}
                        disabled={invited || busy}
                        style={[
                          styles.circle,
                          { backgroundColor: invited ? theme.backgroundSelected : theme.accentIndigo },
                          busy && styles.busy,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          invited ? 'Invited' : `Invite ${friend.display_name ?? 'friend'}`
                        }
                      >
                        <SymbolView
                          name={invited ? 'checkmark' : 'plus'}
                          size={14}
                          weight="bold"
                          tintColor={invited ? theme.textSecondary : theme.accentText}
                          fallback={
                            <Ionicons
                              name={invited ? 'checkmark' : 'add'}
                              size={18}
                              color={invited ? theme.textSecondary : theme.accentText}
                            />
                          }
                        />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </>
          ) : (
            orderedMembers.map((member) => {
              const isGroupOwner = member.user_id === group.owner_id;
              const name = member.profiles?.display_name ?? 'Unknown user';

              return (
                <Pressable
                  key={member.user_id}
                  style={styles.row}
                  onPress={() => showProfile(member.user_id)}
                  accessibilityLabel={`Open ${name}'s profile`}
                >
                  
					<View>
						{isGroupOwner && (
							Platform.OS === 'ios' ? (
								<SymbolView
									name="crown.fill"
									size={14}
									tintColor={theme.accentIndigo}
									type="monochrome"
									style={styles.crown}
								/>
							) : (
								<MaterialCommunityIcons
									name="crown"
									size={14}
									color={theme.accentIndigo}
									style={styles.crown}
								/>
							)
						)}

						<Avatar
							uri={member.profiles?.avatar_url}
							color={theme.backgroundSelected}
						/>
					</View>

                  <ThemedText style={styles.name} numberOfLines={1}>
                    {name}
                  </ThemedText>

                  <Pressable
                    onPress={() => openMenu(member)}
                    hitSlop={8}
                    style={[styles.circle, { backgroundColor: theme.backgroundElement }]}
                    accessibilityRole="button"
                    accessibilityLabel={`More options for ${name}`}
                  >
                    <SymbolView
                      name="ellipsis"
                      size={14}
                      weight="bold"
                      tintColor={theme.accentIndigo}
                      fallback={<Ionicons name="ellipsis-horizontal" size={16} color={theme.accentIndigo} />}
                    />
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cover: { width: COVER, height: COVER, borderRadius: Radius.small },
  titleText: { flex: 1 },
  subtitle: { fontSize: 18, lineHeight: 24 },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  name: { flex: 1, fontSize: 16 },
  crown: { position: 'absolute', top: -10, left: (AVATAR - 14) / 2, zIndex: 1 },

  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  busy: { opacity: 0.5 },
  spinner: { marginTop: Spacing.four },
  error: { color: '#c0392b' },
});