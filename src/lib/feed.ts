/**
 * feed.ts
 *
 * Hämtar händelser till flödet från tabellen activity_events.
 *
 * Vilka händelser användaren får se bestäms helt av databasens RLS-policy,
 * inte av den här filen. Frågan nedan hämtar därför "alla händelser", och
 * databasen returnerar bara de som användaren har rätt att se:
 *   - händelser riktade direkt till användaren (till exempel betyg på
 *     användarens låt)
 *   - händelser från vänner och gruppkompisar (till exempel valda låtar)
 *   - händelser i grupper användaren är med i
 *
 * Händelserna skapas av triggers i databasen och kan inte skapas från appen.
 */

import { supabase } from '@/lib/supabase';

/** Antal händelser som hämtas per anrop. */
const PAGE_SIZE = 30;

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