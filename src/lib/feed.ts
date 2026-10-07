/**
 * feed.ts
 *
 * Hämtar händelser till flödet från tabellen activity_events.
 *
 * Vilka händelser användaren får se bestäms av databasens RLS-policy,
 * inte av den här filen. Filen begränsar dessutom till de händelsetyper
 * som appen kan visa, och utesluter rena notiser (delivery = 'push').
 *
 * Händelserna skapas av triggers i databasen och kan inte skapas från appen.
 */

import { supabase } from '@/lib/supabase';

/** Antal händelser som hämtas per anrop. */
const PAGE_SIZE = 30;

/**
 * Händelsetyper som flödet visar. Andra typer kan finnas i databasen men
 * hämtas inte, så att de inte tar upp platser i flödet utan att synas.
 *
 * Lägg till en typ här samtidigt som i describeEvent i feed-item.tsx.
 */
const SUPPORTED_TYPES = [
  'song_chosen',
  'song_rated',
  'group_all_rated',
  'song_match',
  'favorite_album_changed',
  'friend_request_received',
  'friend_request_accepted',
  'group_invite_received',
  'member_joined_group',
  'joined_via_your_link',
  'group_playlist_complete',
] as const;

/**
 * Hämtar de senaste händelserna i flödet, nyast först.
 *
 * @param before Valfri tidpunkt (created_at). Om den anges hämtas endast
 *               händelser som är äldre än den. Används för att ladda fler
 *               händelser när användaren scrollar längst ner.
 * @returns      En lista med händelser, inklusive aktörens profil, låten
 *               och gruppen som händelsen gäller.
 * @throws       Om Supabase returnerar ett fel.
 */
export async function fetchFeed(before?: string) {
  let query = supabase
    .from('activity_events')
    .select(`
      id,
      type,
      audience,
      metadata,
      created_at,
      read_at,
      actor:profiles!activity_events_actor_id_fkey ( id, display_name, avatar_url ),
      song:daily_songs ( id, track_name, artist_name, image_url, spotify_track_id ),
      group:groups ( id, name )
    `)
    .in('delivery', ['feed', 'both'])
    .in('type', SUPPORTED_TYPES)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * En händelse i flödet, så som fetchFeed returnerar den.
 *
 * Typen räknas fram automatiskt från frågan ovan, så den uppdateras av sig
 * själv om fler fält läggs till i select.
 */
export type FeedEvent = Awaited<ReturnType<typeof fetchFeed>>[number];