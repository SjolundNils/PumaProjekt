/**
 * feed-item.tsx
 *
 * Visar en händelse i flödet: aktörens profilbild, en text som beror på
 * händelsens typ, tiden sedan händelsen och låtens omslag.
 *
 * Händelsetyper som inte stöds än visas inte alls (komponenten returnerar
 * null), så att nya typer i databasen inte ger trasiga rader i flödet.
 *
 * Ett tryck på raden öppnar låten i Spotify.
 */

import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { FeedEvent } from '@/lib/feed';

type Props = {
  event: FeedEvent;
};

export function FeedItem({ event }: Props) {
  const text = describeEvent(event);
  if (!text) return null;

  const song = event.song;

  /** Öppnar låten i Spotify-appen, eller på webben om appen saknas. */
  function openInSpotify() {
    if (!song) return;
    Linking.openURL(`https://open.spotify.com/track/${song.spotify_track_id}`);
  }

  return (
    <Pressable style={styles.row} onPress={openInSpotify} disabled={!song}>
      {event.actor?.avatar_url ? (
        <Image source={{ uri: event.actor.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}

      <View style={styles.body}>
        <ThemedText>{text}</ThemedText>
        {song && (
          <ThemedText style={styles.songText} numberOfLines={1}>
            {song.track_name} · {song.artist_name}
          </ThemedText>
        )}
        <ThemedText style={styles.time}>{formatRelativeTime(event.created_at)}</ThemedText>
      </View>

      {song?.image_url && <Image source={{ uri: song.image_url }} style={styles.cover} />}
    </Pressable>
  );
}

/**
 * Returnerar texten för en händelse, eller null om typen inte stöds än.
 *
 * Nya händelsetyper läggs till här.
 */
function describeEvent(event: FeedEvent): string | null {
  const name = event.actor?.display_name ?? 'Någon';

  switch (event.type) {
    case 'song_chosen':
      return `${name} valde dagens låt`;

    case 'song_rated': {
      // metadata är JSON i databasen. För song_rated innehåller den betyget.
      const rating = (event.metadata as { rating?: number } | null)?.rating;
      return rating
        ? `${name} gav din låt ${rating.toString().replace('.', ',')} ★`
        : `${name} betygsatte din låt`;
    }

    default:
      return null;
  }
}

/**
 * Formaterar en tidpunkt som relativ tid, till exempel "nyss",
 * "för 5 min sedan" eller "igår".
 */
function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'nyss';
  if (minutes < 60) return `för ${minutes} min sedan`;
  if (hours < 24) return `för ${hours} h sedan`;
  if (days === 1) return 'igår';
  if (days < 7) return `för ${days} dagar sedan`;
  return new Date(iso).toLocaleDateString('sv-SE');
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: '#ccc' },
  body: { flex: 1, gap: 2 },
  songText: { fontSize: 14, opacity: 0.8 },
  time: { fontSize: 12, opacity: 0.5 },
  cover: { width: 52, height: 52, borderRadius: 4 },
});