/**
 * invite-buttons.tsx
 *
 * Join- och Decline-knappar under en inbjudningshändelse i flödet.
 * Kollar själv om inbjudan fortfarande väntar. Är personen redan medlem
 * visas "Joined", och finns ingen inbjudan visas ingenting.
 */
import { ThemedText } from '@/components/themed-text';
import { ActionButton } from '@/components/ui/action-button';
import { Typography } from '@/constants/theme';
import { acceptInvite, declineInvite, getInviteState } from '@/lib/groupInvites';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

type Props = { groupId: string };
type State = 'loading' | 'pending' | 'member' | 'declined' | 'none';

export function InviteButtons({ groupId }: Props) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    getInviteState(groupId)
      .then((result) => mounted && setState(result))
      .catch(() => mounted && setState('none'));
    return () => {
      mounted = false;
    };
  }, [groupId]);

  async function handle(action: 'accept' | 'decline') {
    setBusy(true);
    try {
      if (action === 'accept') {
        await acceptInvite(groupId);
        setState('member');
      } else {
        await declineInvite(groupId);
        setState('declined');
      }
    } catch (error) {
      Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Unknown error');
      // Inbjudan kan ha dragits tillbaka eller redan hanterats: läs läget på nytt
      getInviteState(groupId).then(setState).catch(() => setState('none'));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <ActivityIndicator style={styles.spinner} />;
  if (state === 'member') return <ThemedText themeColor="textSecondary" style={Typography.bodySmall}>✓ Joined</ThemedText>;
  if (state === 'declined') return <ThemedText themeColor="textSecondary" style={Typography.bodySmall}>Declined</ThemedText>;
  if (state === 'none') return null;

  return (
    <View style={styles.row}>
      <ActionButton
        label="Join"
        color="indigo"
        size="small"
        onPress={() => handle('accept')}
        disabled={busy}
      />
      <ActionButton
        label="Decline"
        color="destructiveSecondary"
        size="small"
        onPress={() => handle('decline')}
        disabled={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  spinner: { alignSelf: 'flex-start', marginTop: 6 },
  done: { marginTop: 6, opacity: 0.6, fontWeight: '600' },
});