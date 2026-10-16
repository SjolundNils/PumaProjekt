/**
 * groups.tsx
 *
 * Huvudskärm för grupper. Visar grupperna användaren är med i, och en flik för
 * inbjudningar där man kan gå med eller tacka nej.
 */
import { acceptInvite, declineInvite, GroupInvite, listGroupInvites } from '@/lib/groupInvites';
import { supabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Group = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type Tab = 'groups' | 'invites';

export default function GroupsScreen() {
  const [tab, setTab] = useState<Tab>('groups');
  const [groups, setGroups] = useState<Group[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  // Gruppen vars inbjudan hanteras just nu, så att knapparna inte trycks två gånger
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);

  /** Hämtar grupperna jag är med i och mina väntande inbjudningar. */
  async function load() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const [groupsResult, inviteList] = await Promise.all([
        supabase
          .from('group_members')
          .select('group_id, groups(id, name, avatar_url)')
          .eq('user_id', userData.user.id),
        listGroupInvites(),
      ]);
      if (groupsResult.error) throw groupsResult.error;

      setGroups(
        groupsResult.data
          .map((item) => item.groups)
          .filter((group): group is Group => group !== null)
      );
      setInvites(inviteList);
    } catch (error) {
      Alert.alert('Could not load groups', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Laddar om varje gång sidan visas, så att nya inbjudningar syns
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function handleAccept(invite: GroupInvite) {
    setBusyGroupId(invite.group_id);
    try {
      await acceptInvite(invite.group_id);
      await load();
      setTab('groups');
    } catch (error) {
      Alert.alert('Could not join', error instanceof Error ? error.message : 'Unknown error');
      await load(); // inbjudan kan ha dragits tillbaka
    } finally {
      setBusyGroupId(null);
    }
  }

  async function handleDecline(invite: GroupInvite) {
    setBusyGroupId(invite.group_id);
    try {
      await declineInvite(invite.group_id);
      await load();
    } catch (error) {
      Alert.alert('Could not decline', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusyGroupId(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Groups</Text>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('groups')}>
          <Text style={[styles.tab, tab === 'groups' && styles.tabActive]}>Groups</Text>
        </Pressable>
        <Pressable onPress={() => setTab('invites')}>
          <Text style={[styles.tab, tab === 'invites' && styles.tabActive]}>
            Invites{invites.length > 0 ? ` (${invites.length})` : ''}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <ScrollView>
          {tab === 'groups' && (
            <>
              {groups.length === 0 && <Text style={styles.empty}>You are not in any groups yet.</Text>}
              {groups.map((group) => (
                <Pressable
                  key={group.id}
                  style={styles.groupRow}
                  onPress={() =>
                    router.push({ pathname: '/group-detail-test', params: { id: group.id } })
                  }
                >
                  {group.avatar_url ? (
                    <Image source={{ uri: group.avatar_url }} style={styles.groupImage} />
                  ) : (
                    <View style={[styles.groupImage, styles.imagePlaceholder]} />
                  )}
                  <Text style={styles.groupName}>{group.name}</Text>
                </Pressable>
              ))}
            </>
          )}

          {tab === 'invites' && (
            <>
              {invites.length === 0 && <Text style={styles.empty}>No pending invites.</Text>}
              {invites.map((invite) => {
                const busy = busyGroupId === invite.group_id;
                return (
                  <Pressable
                    key={invite.group_id}
                    style={styles.groupRow}
                    onPress={() =>
                      router.push({ pathname: '/group-detail-test', params: { id: invite.group_id } })
                    }
                  >
                    {invite.avatar_url ? (
                      <Image source={{ uri: invite.avatar_url }} style={styles.groupImage} />
                    ) : (
                      <View style={[styles.groupImage, styles.imagePlaceholder]} />
                    )}
                    <View style={styles.inviteText}>
                      <Text style={styles.groupName}>{invite.group_name}</Text>
                      <Text style={styles.meta}>
                        Invited by {invite.inviter_name ?? 'someone'} · {invite.member_count} members
                      </Text>
                      <View style={styles.buttons}>
                        <Pressable
                          style={[styles.joinButton, busy && styles.disabled]}
                          onPress={() => handleAccept(invite)}
                          disabled={busy}
                        >
                          <Text style={styles.joinText}>Join</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.declineButton, busy && styles.disabled]}
                          onPress={() => handleDecline(invite)}
                          disabled={busy}
                        >
                          <Text style={styles.declineText}>Decline</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 20, marginTop: 12 },
  tab: { fontSize: 16, color: '#999' },
  tabActive: { color: '#000', fontWeight: '700' },
  empty: { color: '#888', marginTop: 24 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  groupImage: { width: 60, height: 60, borderRadius: 12 },
  imagePlaceholder: { backgroundColor: '#ddd' },
  groupName: { fontSize: 16, fontWeight: '600' },
  inviteText: { flex: 1, gap: 2 },
  meta: { fontSize: 12, color: '#888' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 6 },
  joinButton: { backgroundColor: '#5B4DF5', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 16 },
  joinText: { color: '#fff', fontWeight: '600' },
  declineButton: { backgroundColor: '#FDE4E4', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 16 },
  declineText: { color: '#D33', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});