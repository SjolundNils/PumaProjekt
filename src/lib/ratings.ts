/**
 * ratings.ts
 *
 * Funktioner för betyg på dagens låtar. Används av alla skärmar som visar
 * eller låter användaren betygsätta låtar.
 *
 * Ett betyg gäller en persons val av dagens låt (en rad i daily_songs),
 * inte låten i sig.
 */

import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

/**
 * Öppnar betygsrutan för en låt.
 *
 * @param dailySongId Id:t för raden i daily_songs, inte Spotifys låt-id.
 */
export function openRatingSheet(dailySongId: number): void {
  router.push({ pathname: '/rate/[songId]', params: { songId: String(dailySongId) } });
}

/**
 * Hämtar den inloggade användarens betyg för en lista med låtar.
 *
 * @param dailySongIds Id:n för raderna i daily_songs som ska kontrolleras.
 * @returns            Ett objekt där nyckeln är låtens id och värdet betyget.
 *                     Låtar utan betyg från användaren finns inte med.
 * @throws             Om Supabase returnerar ett fel.
 */
export async function fetchMyRatings(dailySongIds: number[]): Promise<Record<number, number>> {
  if (dailySongIds.length === 0) return {};

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return {};

  const { data, error } = await supabase
    .from('song_ratings')
    .select('daily_song_id, rating')
    .eq('user_id', userId)
    .in('daily_song_id', dailySongIds);

  if (error) throw error;

  return Object.fromEntries(data.map((row) => [row.daily_song_id, row.rating]));
}

  /**
 * Hämtar genomsnittsbetyget för en lista med dagens låtar.
 *
 * @param dailySongIds ID:n för låtarna i daily_songs.
 * @returns Ett objekt med låtens id och dess genomsnittsbetyg.
 */
export async function fetchAverageRatings(
  dailySongIds: number[]
): Promise<Record<number, number>> {
  if (dailySongIds.length === 0) return {};

  const { data, error } = await supabase
    .from('song_ratings')
    .select('daily_song_id, rating')
    .in('daily_song_id', dailySongIds);

  if (error) throw error;

  const averages: Record<number, number> = {};

  for (const songId of dailySongIds) {
    // Hittar alla betyg för den här låten
    const songRatings = data.filter(
      (row) => row.daily_song_id === songId
    );

    if (songRatings.length === 0) continue;

    // Räknar ut genomsnittet
    const total = songRatings.reduce(
      (sum, row) => sum + row.rating,
      0
    );

    averages[songId] = total / songRatings.length;
  }

  return averages;

}