/**
 * groups.tsx
 *
 * Huvudskärm för grupper. Visar grupperna användaren är med i, med antal
 * medlemmar och hur många som har valt dagens låt, och en flik för
 * inbjudningar där man kan gå med eller tacka nej.
 *
 * Färger och mått kommer från temat, så sidan följer ljust och mörkt läge.
 */

import { router, useFocusEffect } from 'expo-router';
import { ComponentRef, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useScrollToTopOnTabPress } from '@/hooks/use-scroll-to-top-on-tab-press';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/errors';
import { acceptInvite, declineInvite, listGroupInvites, type GroupInvite } from '@/lib/groupInvites';
import { listMyGroups, type MyGroup } from '@/lib/myGroups';
import { createTextStyles } from '@/styles/text';
import { SymbolView } from 'expo-symbols';

type Tab = 'groups' | 'invites';

const COVER = 85;

export default function GroupsScreen() {
  const theme = useTheme();
  const textStyles = createTextStyles(theme);

  const [tab, setTab] = useState<Tab>('groups');
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Gruppen vars inbjudan hanteras just nu, så att knapparna inte trycks två gånger
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);

  // Ett tryck på fliken i flikraden scrollar upp till toppen.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  useScrollToTopOnTabPress(scrollRef);

  /** Hämtar grupperna jag är med i och mina väntande inbjudningar. */
  const load = useCallback(async () => {
    try {
      const [groupList, inviteList] = await Promise.all([listMyGroups(), listGroupInvites()]);
      setGroups(groupList);
      setInvites(inviteList);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Laddar om varje gång sidan visas, så att nya grupper och inbjudningar syns
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleAccept(invite: GroupInvite) {
    setBusyGroupId(invite.group_id);
    try {
      await acceptInvite(invite.group_id);
      await load();
      setTab('groups');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyGroupId(null);
    }
  }

  const openGroup = (groupId: string) =>
    router.push({ pathname: '/group/[id]', params: { id: groupId } });

  /** Gruppens omslagsbild, eller en grå ruta om den saknar bild. */
  const cover = (url: string | null) =>
    url ? (
      <Image source={{ uri: url }} style={styles.cover} />
    ) : (
      <View style={[styles.cover, { backgroundColor: theme.backgroundSelected }]} />
    );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.four }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {/* Rubrik och knapp för ny grupp */}
          <View style={styles.titleRow}>
            <View>
              <ThemedText style={textStyles.pageTitle}>Groups</ThemedText>
              <ThemedText style={textStyles.pageSubtitle}>
                One song goes far
              </ThemedText>
            </View>
            <ActionButton
              label="New"
              icon="add"
              size="medium"
              color="base"
              onPress={() => router.push('/create-group')}
            />
          </View>

          {/* Flikar */}
          <View style={styles.tabs}>
            <Pressable onPress={() => setTab('groups')} hitSlop={8}>
              <ThemedText
                style={[
                  styles.tab,
                  { color: tab === 'groups' ? theme.text : theme.textSecondary },
                  tab === 'groups' && styles.tabActive,
                ]}
              >
                Groups
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setTab('invites')} hitSlop={8}>
              <ThemedText
                style={[
                  styles.tab,
                  { color: tab === 'invites' ? theme.text : theme.textSecondary },
                  tab === 'invites' && styles.tabActive,
                ]}
              >
                Invites{invites.length > 0 ? ` (${invites.length})` : ''}
              </ThemedText>
            </Pressable>
          </View>

          {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

          {loading ? (
            <ActivityIndicator style={styles.spinner} />
          ) : tab === 'groups' ? (
            <>
              {groups.length === 0 && (
                <ThemedText style={{ color: theme.textSecondary }}>
                  You are not in any groups yet. Tap "New" to create one.
                </ThemedText>
              )}

              {groups.map((group) => (
                <Pressable
                  key={group.group_id}
                  style={styles.row}
                  onPress={() => openGroup(group.group_id)}
                  accessibilityLabel={`Open ${group.name}`}
                >
                  {cover(group.avatar_url)}
                  <View style={styles.rowText}>
                    <View style={styles.nameRow}>
                      <ThemedText style={[styles.name, styles.nameShrink]} numberOfLines={1}>
                        {group.name}
                      </ThemedText>
                      {group.is_owner && (
                        <SymbolView
                          name="crown.fill"
                          size={16}
                          tintColor={theme.accentIndigo}
                          accessibilityLabel="Owner"
                        />
                      )}
                    </View>
                    <ThemedText style={[styles.meta, { color: theme.textSecondary }]}>
                      <SymbolView name="music.note" size={16} tintColor={theme.textSecondary} /> {group.songs_today} / {group.member_count}
                    </ThemedText>
                  </View>
                  <SymbolView name="chevron.forward" size={20} tintColor={theme.textSecondary} />
                </Pressable>
              ))}
            </>
          ) : (
            <>
              {invites.length === 0 && (
                <ThemedText style={{ color: theme.textSecondary }}>No pending invites.</ThemedText>
              )}

              {invites.map((invite) => {
                const busy = busyGroupId === invite.group_id;
                return (
                  <Pressable
                    key={invite.group_id}
                    style={styles.row}
                    onPress={() => openGroup(invite.group_id)}
                    accessibilityLabel={`Open ${invite.group_name}`}
                  >
                    {cover(invite.avatar_url)}
                    <View style={styles.rowText}>
                      <ThemedText style={styles.name} numberOfLines={1}>
                        {invite.group_name}
                      </ThemedText>
                      <ThemedText style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                        Invited by {invite.inviter_name ?? 'someone'} · {invite.member_count} members
                      </ThemedText>
                      <View style={styles.inviteButtons}>
                        <ActionButton
                          label="Join"
                          icon="add"
                          size="small"
                          color="indigo"
                          disabled={busy}
                          onPress={() => handleAccept(invite)}
                        />
                        <ActionButton
                          label="Decline"
                          icon="close"
                          size="small"
                          color="destructiveSecondary"
                          disabled={busy}
                          onPress={() => handleDecline(invite)}
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.six, gap: Spacing.three },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tabs: { flexDirection: 'row', justifyContent: 'space-between' },
  tab: { fontSize: 14, fontWeight: '500' },
  tabActive: { fontWeight: '700' },
  error: { color: '#c0392b' },
  spinner: { marginTop: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cover: { width: COVER, height: COVER },
  rowText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  name: { fontSize: 18, fontWeight: '600' },
  nameShrink: { flexShrink: 1 },
  meta: { fontSize: 14 },
  inviteButtons: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
});