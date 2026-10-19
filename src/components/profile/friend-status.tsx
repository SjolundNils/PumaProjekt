/**
 * friend-status.tsx
 *
 * Visar hur den inloggade användaren och en annan användare hänger ihop
 * som vänner, och låter användaren ändra det.
 *
 * Visas på andras profiler, på samma plats som Friends-knappen på den egna
 * profilen (se profile-view.tsx).
 *
 * Läget räknas fram från listFriendships i lib/friends.ts:
 *   - friends:  accepterad vänskap. Etikett och meny som kan ta bort vännen.
 *   - sent:     användaren har skickat en förfrågan. Etikett och meny som
 *               kan dra tillbaka den.
 *   - received: den andra har skickat en förfrågan. Etikett och meny som
 *               kan acceptera eller neka.
 *   - none:     ingen vänskap. En knapp som skickar en förfrågan direkt.
 */

import { ActionButton } from '@/components/ui/action-button';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/errors';
import {
    acceptRequest,
    type Friendship,
    listFriendships,
    removeFriendship,
    sendFriendRequest,
} from '@/lib/friends';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

type Props = {
  /** Användaren vars profil visas. */
  userId: string;
};

type Status =
  | { kind: 'friends'; friendship: Friendship }
  | { kind: 'sent'; friendship: Friendship }
  | { kind: 'received'; friendship: Friendship }
  | { kind: 'none' };

/** Etiketten som visas för lägena med meny. Läget none har en egen knapp. */
const LABELS = {
  friends: { label: 'Friends', icon: 'checkmark', color: 'base' },
  sent: { label: 'Requested', icon: 'time-outline', color: 'base' },
  received: { label: 'Wants to be friends', icon: 'person-add-outline', color: 'orange' },
} as const;

export function FriendStatus({ userId }: Props) {
  const theme = useTheme();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Räknar fram läget utifrån den inloggade användarens vänskaper.
   */
  const load = useCallback(async () => {
    try {
      const friendships = await listFriendships();
      const friendship = friendships.find((f) => f.friend_id === userId);

      if (!friendship) {
        setStatus({ kind: 'none' });
      } else if (friendship.status === 'accepted') {
        setStatus({ kind: 'friends', friendship });
      } else if (friendship.direction === 'outgoing') {
        setStatus({ kind: 'sent', friendship });
      } else {
        setStatus({ kind: 'received', friendship });
      }
    } catch (error) {
      console.log('Kunde inte hämta vänskap:', error);
      setStatus({ kind: 'none' });
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Kör en ändring, och hämtar sedan läget på nytt så att etiketten
   * och menyn stämmer.
   */
  async function run(action: () => Promise<unknown>, errorTitle: string) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (error) {
      Alert.alert(errorTitle, getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  /** Frågar en extra gång innan en vän tas bort, eftersom det inte går att ångra. */
  function confirmRemove(friendship: Friendship) {
    Alert.alert(
      'Remove friend?',
      `${friendship.display_name ?? 'This person'} will no longer be your friend.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => run(() => removeFriendship(friendship.friendship_id), 'Could not remove friend'),
        },
      ]
    );
  }

  /** Öppnar menyn, med de val som passar läget. */
  function openMenu() {
    if (!status) return;

    switch (status.kind) {
      case 'friends':
        Alert.alert(status.friendship.display_name ?? 'Friend', undefined, [
          { text: 'Remove friend', style: 'destructive', onPress: () => confirmRemove(status.friendship) },
          { text: 'Cancel', style: 'cancel' },
        ]);
        break;

      case 'sent':
        Alert.alert('Friend request sent', undefined, [
          {
            text: 'Cancel request',
            style: 'destructive',
            onPress: () =>
              run(() => removeFriendship(status.friendship.friendship_id), 'Could not cancel request'),
          },
          { text: 'Close', style: 'cancel' },
        ]);
        break;

      case 'received':
        Alert.alert(
          'Friend request',
          `${status.friendship.display_name ?? 'This person'} wants to be your friend.`,
          [
            {
              text: 'Accept',
              onPress: () =>
                run(() => acceptRequest(status.friendship.friendship_id), 'Could not accept request'),
            },
            {
              text: 'Decline',
              style: 'destructive',
              onPress: () =>
                run(() => removeFriendship(status.friendship.friendship_id), 'Could not decline request'),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        break;
    }
  }

  if (!status) return <ActivityIndicator />;

  // Inte vänner: en enda knapp som skickar en vänförfrågan direkt.
  if (status.kind === 'none') {
    return (
      <ActionButton
        label={busy ? 'Sending...' : 'Add friend'}
        icon="person-add"
        size="medium"
        color="indigo"
        disabled={busy}
        onPress={() => run(() => sendFriendRequest(userId), 'Could not send request')}
      />
    );
  }

  // Övriga lägen: en etikett och en meny för att ändra vänskapen.
  // Etiketten öppnar också menyn, så att hela knappen går att trycka på.
  const { label, icon, color } = LABELS[status.kind];

  return (
    <View style={styles.row}>
      <ActionButton
        label={label}
        icon={icon}
        size="medium"
        color={color}
        disabled={busy}
        onPress={openMenu}
      />

      <Pressable
        style={({ pressed }) => [
          styles.menuButton,
          { backgroundColor: theme.backgroundElement },
          { opacity: busy ? 0.5 : pressed ? 0.7 : 1 },
        ]}
        onPress={openMenu}
        disabled={busy}
        hitSlop={6}
        accessibilityLabel="Friend options"
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator size="small" />
        ) : (
          <Ionicons name="ellipsis-horizontal" size={16} color={theme.text} />
        )}
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Samma höjd och bakgrund som en ActionButton i storleken medium.
  menuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});