/**
 * feed-item.tsx
 *
 * Visar en händelse i flödet: aktörens profilbild, en text som beror på
 * händelsens typ, tiden sedan händelsen och ett omslag.
 *
 * Händelsetyper som inte stöds visas inte alls (komponenten returnerar
 * null), så att nya typer i databasen inte ger trasiga rader i flödet.
 *
 * Ett tryck på raden öppnar låten eller albumet i Spotify, om händelsen
 * har någon av dem. På valda låtar från andra visas en RateButton under
 * låttiteln (se components/rating/rate-button.tsx).
 */

import { InviteButtons } from '@/components/groups/invite-buttons';
import { FriendRequestButtons } from '@/components/friends/friend-request-buttons';
import { RateButton } from '@/components/rating/rate-button';
import { ThemedText } from '@/components/themed-text';
import { ComponentSize, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayInSweden } from '@/lib/dates';
import type { FeedEvent } from '@/lib/feed';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

type Props = {
  event: FeedEvent;
  /**
   * Den inloggade användarens id. Används för att inte visa
   * betygsknappen på användarens egen låt.
   */
  currentUserId?: string | null;
  /** Användarens eget betyg på låten, om hen har betygsatt den. */
  myRating?: number;
};

/**
 * Fälten som kan finnas i metadata. Vilka som är ifyllda beror på
 * händelsetypen (se triggerna i databasen).
 */
type EventMetadata = {
  rating?: number;
  match?: 'track' | 'artist';
  spotify_album_id?: string;
  album_name?: string;
  artist_name?: string;
  image_url?: string;
};

type FeedCardKind = 'user-to-track' | 'user-to-group' | 'group-to-track' | 'friend-request';

export function FeedItem({ event, currentUserId, myRating }: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const text = describeEvent(event);
  if (!text) return null;

  const cardKind = getCardKind(event);
  const song = event.song;
  const metadata = (event.metadata ?? {}) as EventMetadata;

  // Låtens omslag, eller albumets omslag för favoritalbum (som saknar låt).
  const coverUrl = song?.image_url ?? metadata.image_url ?? null;

  // Länken som öppnas vid tryck: låten om händelsen har en, annars albumet.
  const spotifyUrl = song
    ? `https://open.spotify.com/track/${song.spotify_track_id}`
    : metadata.spotify_album_id
      ? `https://open.spotify.com/album/${metadata.spotify_album_id}`
      : null;

  // Betygsknappen visas på valda låtar, men inte på användarens egna.
  const showRating =
    event.type === 'song_chosen' && song !== null && event.actor?.id !== currentUserId;

  /** Öppnar aktörens profil, eller profilfliken om det är användaren själv. */
  function openProfile() {
    if (!event.actor) return;
    if (event.actor.id === currentUserId) {
      router.navigate('/profile');
      return;
    }
    router.push({ pathname: '/user/[userId]', params: { userId: event.actor.id } });
  }

  function openGroup() {
    if (!event.group) return;
    router.push({ pathname: '/group-detail-test', params: { id: event.group.id.toString() } });
  }

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        {cardKind === 'group-to-track' ? (
          <Pressable
            onPress={openGroup}
            disabled={!event.group}
            accessibilityLabel={`Open ${event.group?.name ?? 'group'}`}
          >
            {event.group?.avatar_url ? (
              <Image source={{ uri: event.group.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.groupPlaceholder]}>
                <Ionicons name="people" size={18} color={theme.accentIndigo} />
              </View>
            )}
          </Pressable>
        ) : (
          /* Egen tryckyta: öppnar aktörens profil istället för Spotify. */
          <Pressable
            onPress={openProfile}
            disabled={!event.actor}
            hitSlop={6}
            accessibilityLabel={`Open ${event.actor?.display_name ?? 'profile'}`}
          >
            {event.actor?.avatar_url ? (
              <Image source={{ uri: event.actor.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
          </Pressable>
        )}
        <ThemedText style={styles.eventText} numberOfLines={2}>
          {renderEventText(
            text,
            event.actor?.display_name,
            openProfile,
            event.group?.name,
            openGroup,
          )}
        </ThemedText>
      </View>

      {cardKind === 'user-to-group' && event.group && (
        <Pressable
          style={styles.contentCard}
          onPress={openGroup}
          accessibilityLabel={`Open ${event.group.name}`}
        >
          {event.group.avatar_url ? (
            <Image source={{ uri: event.group.avatar_url }} style={styles.groupIcon} />
          ) : (
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={22} color={theme.accentIndigo} />
            </View>
          )}
          <View style={styles.contentText}>
            <ThemedText numberOfLines={1}>{event.group.name}</ThemedText>
            <ThemedText themeColor="textSecondary" style={Typography.bodySmall}>
              Group
            </ThemedText>
          </View>
        </Pressable>
      )}
      {(cardKind === 'user-to-track' || cardKind === 'group-to-track') && (song || metadata.album_name) && (
        <Pressable
          style={styles.contentCard}
          onPress={() => spotifyUrl && Linking.openURL(spotifyUrl)}
          disabled={!spotifyUrl}
          accessibilityLabel="Open in Spotify"
        >
          {coverUrl && <Image source={{ uri: coverUrl }} style={styles.cover} />}
          <View style={styles.contentText}>
            <ThemedText numberOfLines={1}>
              {song?.track_name ?? metadata.album_name}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={Typography.bodySmall} numberOfLines={1}>
              {song?.artist_name ?? metadata.artist_name}
            </ThemedText>
          </View>
        </Pressable>
      )}

      <View style={styles.footer}>
        {/* Egen tryckyta inuti raden: öppnar betygsrutan istället för Spotify. */}
        {showRating && song && (
          <RateButton
            dailySongId={song.id}
            myRating={myRating}
            editable={song.song_date === todayInSweden()}
          />
        )}

        {/* Inbjudan till en grupp: Join/Decline direkt i flödet. */}
        {event.type === 'group_invite_received' && event.group?.id && (
          <InviteButtons groupId={event.group.id} />
        )}

        {event.type === 'friend_request_received' && event.actor?.id && (
          <FriendRequestButtons userId={event.actor.id} />
        )}

        <ThemedText style={styles.time}>{formatRelativeTime(event.created_at)}</ThemedText>
      </View>
    </View>
  );
}

function renderEventText(
  text: string,
  actorName: string | null | undefined,
  onActorPress: () => void,
  groupName: string | null | undefined,
  onGroupPress: () => void
) {
  const links = [
    actorName
      ? { name: actorName, index: text.indexOf(actorName), onPress: onActorPress }
      : null,
    groupName
      ? { name: groupName, index: text.indexOf(groupName), onPress: onGroupPress }
      : null,
  ]
    .filter((link): link is { name: string; index: number; onPress: () => void } => (
      link !== null && link.index >= 0
    ))
    .sort((a, b) => a.index - b.index);

  if (links.length === 0) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;

  links.forEach((link, index) => {
    if (link.index < cursor) return;

    if (link.index > cursor) {
      parts.push(<Fragment key={`text-${index}`}>{text.slice(cursor, link.index)}</Fragment>);
    }

    parts.push(
      <ThemedText
        key={`link-${index}`}
        onPress={link.onPress}
        accessibilityRole="link"
        accessibilityLabel={`Open ${link.name}`}
      >
        {link.name}
      </ThemedText>
    );
    cursor = link.index + link.name.length;
  });

  if (cursor < text.length) {
    parts.push(<Fragment key="text-end">{text.slice(cursor)}</Fragment>);
  }

  return parts;
}

function getCardKind(event: FeedEvent): FeedCardKind {
  switch (event.type) {
    case 'group_all_rated':
    case 'group_playlist_complete':
      return 'group-to-track';
    case 'member_joined_group':
    case 'joined_via_your_link':
    case 'group_invite_received':
      return 'user-to-group';
    case 'friend_request_received':
    case 'friend_request_accepted':
      return 'friend-request';
    default:
      return 'user-to-track';
  }
}

/**
 * Returnerar texten för en händelse, eller null om typen inte stöds.
 *
 * Nya händelsetyper läggs till här, och i SUPPORTED_TYPES i lib/feed.ts.
 */
function describeEvent(event: FeedEvent): string | null {
  const name = event.actor?.display_name ?? 'Someone';
  const group = event.group?.name ?? 'a group';
  const metadata = (event.metadata ?? {}) as EventMetadata;

  switch (event.type) {
    case 'song_chosen':
      return `${name} picked today's song`;

    case 'song_rated':
      return metadata.rating
        ? `${name} rated your song ${metadata.rating} ★`
        : `${name} rated your song`;

    case 'group_all_rated':
      return `Everyone in ${group} has rated your song`;

    case 'song_match':
      return metadata.match === 'track'
        ? `You and ${name} picked the same song today!`
        : `You and ${name} picked the same artist today`;

    case 'favorite_album_changed':
      return `${name} added a new favorite album`;

    case 'friend_request_received':
      return `${name} wants to be your friend`;

    case 'friend_request_accepted':
      return `${name} accepted your friend request`;

    case 'group_invite_received':
      return `${name} invited you to ${group}`;

    case 'member_joined_group':
      return `${name} joined ${group}`;

    case 'joined_via_your_link':
      return `${name} joined ${group} through your invite`;

    case 'group_playlist_complete':
      return `Everyone in ${group} has picked today's song. The playlist is complete!`;

    default:
      return null;
  }
}

/**
 * Formaterar en tidpunkt som relativ tid, till exempel "just now",
 * "5m ago" eller "yesterday".
 */
function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: {
      position: 'relative',
      gap: Spacing.two,
      padding: Spacing.three,
      paddingVertical: Spacing.two,
      marginBottom: Spacing.two,
      marginTop: Spacing.two,
      backgroundColor: theme.backgroundElement,
      borderRadius: Radius.medium,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    avatar: {
      width: ComponentSize.avatar.small,
      height: ComponentSize.avatar.small,
      borderRadius: Radius.large,
    },
    avatarPlaceholder: { backgroundColor: theme.backgroundElement },
    groupPlaceholder: {
      backgroundColor: theme.backgroundSelected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventText: { flex: 1 },
    footer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.two,
    },
    time: { ...Typography.caption, opacity: 0.5, marginLeft: 'auto' },
    contentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      padding: Spacing.two,
      backgroundColor: theme.background,
      borderRadius: Radius.medium,
    },
    contentText: { flex: 1 },
    groupIcon: {
      width: ComponentSize.cover,
      height: ComponentSize.cover,
      borderRadius: Radius.small,
      backgroundColor: theme.backgroundSelected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cover: {
      width: ComponentSize.cover,
      height: ComponentSize.cover,
      borderRadius: Radius.small,
    },
  });
}