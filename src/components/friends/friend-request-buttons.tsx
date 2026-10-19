import { ThemedText } from '@/components/themed-text';
import { ActionButton } from '@/components/ui/action-button';
import { Typography } from '@/constants/theme';
import { acceptRequest, listFriendships, removeFriendship } from '@/lib/friends';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

type Props = {
  userId: string;
};

type State = 'loading' | 'pending' | 'accepted' | 'declined' | 'none';

export function FriendRequestButtons({ userId }: Props) {
  const [state, setState] = useState<State>('loading');
  const [friendshipId, setFriendshipId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    listFriendships()
      .then((friendships) => {
        if (!mounted) return;
        const request = friendships.find(
          (friendship) =>
            friendship.friend_id === userId &&
            friendship.status === 'pending' &&
            friendship.direction === 'incoming'
        );

        if (!request) {
          setState('none');
          return;
        }

        setFriendshipId(request.friendship_id);
        setState('pending');
      })
      .catch(() => mounted && setState('none'));

    return () => {
      mounted = false;
    };
  }, [userId]);

  async function handle(action: 'accept' | 'decline') {
    if (friendshipId === null) return;

    setBusy(true);
    try {
      if (action === 'accept') {
        await acceptRequest(friendshipId);
        setState('accepted');
      } else {
        await removeFriendship(friendshipId);
        setState('declined');
      }
    } catch (error) {
      Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Unknown error');
      setState('none');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <ActivityIndicator style={styles.spinner} />;
  if (state === 'accepted') {
    return <ThemedText themeColor="textSecondary" style={Typography.bodySmall}>✓ Friends</ThemedText>;
  }
  if (state === 'declined') {
    return <ThemedText themeColor="textSecondary" style={Typography.bodySmall}>Declined</ThemedText>;
  }
  if (state === 'none') return null;

  return (
    <View style={styles.row}>
      <ActionButton
        label="Add Friend"
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
  row: { flexDirection: 'row', gap: 8 },
  spinner: { alignSelf: 'flex-start' },
});
