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

import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { RateButton } from '@/components/rating/rate-button';
import { ThemedText } from '@/components/themed-text';
import type { FeedEvent } from '@/lib/feed';

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

export function FeedItem({ event, currentUserId, myRating }: Props) {
  const text = describeEvent(event);
  if (!text) return null;

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

  // Undertext: låten, eller albumet för favoritalbum.
  const subtitle = song
    ? `${song.track_name} · ${song.artist_name}`
    : metadata.album_name
      ? `${metadata.album_name} · ${metadata.artist_name ?? ''}`
      : null;

  // Betygsknappen visas på valda låtar, men inte på användarens egna.
  const showRating =
    event.type === 'song_chosen' && song !== null && event.actor?.id !== currentUserId;

  return (
    <Pressable
      style={styles.row}
      onPress={() => spotifyUrl && Linking.openURL(spotifyUrl)}
      disabled={!spotifyUrl}
    >
      {event.actor?.avatar_url ? (
        <Image source={{ uri: event.actor.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}

      <View style={styles.body}>
        <ThemedText>{text}</ThemedText>
        {subtitle && (
          <ThemedText style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        )}

        {/* Egen tryckyta inuti raden: öppnar betygsrutan istället för Spotify. */}
        {showRating && song && <RateButton dailySongId={song.id} myRating={myRating} />}

        <ThemedText style={styles.time}>{formatRelativeTime(event.created_at)}</ThemedText>
      </View>

      {coverUrl && <Image source={{ uri: coverUrl }} style={styles.cover} />}
    </Pressable>
  );
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: '#ccc' },
  body: { flex: 1, gap: 2 },
  subtitle: { fontSize: 14, opacity: 0.8 },
  time: { fontSize: 12, opacity: 0.5 },
  cover: { width: 52, height: 52, borderRadius: 4 },
});