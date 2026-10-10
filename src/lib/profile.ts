/**
 * profile.ts
 *
 * Hämtar all data som behövs för att visa en profil: profilen själv,
 * favoritalbumen och dagens låt.
 *
 * Används både för den inloggade användarens egen profil och för andras
 * profiler, samt av redigeringssidan. Det är det enda stället i appen där
 * det står hur en profil läses från databasen.
 *
 * Alla inloggade får läsa profiler, favoritalbum och dagens låtar enligt
 * databasens RLS-policyer, så funktionen fungerar för vilken användare som
 * helst.
 */

import { todayInSweden } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

/** Antal platser för favoritalbum. Motsvarar check-regeln i databasen. */
export const ALBUM_SLOTS = 6;

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  biography: string | null;
};

export type SpotifyProfile = {
  user_name: string | null;
  image_url: string | null;
};

export type FavoriteAlbum = {
  position: number;
  spotify_album_id: string;
  album_name: string;
  artist_name: string;
  image_url: string | null;
};

export type TodaysSong = {
  /** Id:t för raden i daily_songs. Behövs för att kunna betygsätta låten. */
  id: number;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  image_url: string | null;
};

export type ProfileData = {
  profile: Profile;
  /** Favoritalbumen, sorterade efter plats. Tomma platser finns inte med. */
  albums: FavoriteAlbum[];
  /** Dagens låt, eller null om användaren inte har valt någon idag. */
  todaysSong: TodaysSong | null;
};

/**
 * Hämtar profilen, favoritalbumen och dagens låt för en användare.
 *
 * De tre frågorna är oberoende och körs parallellt.
 *
 * @param userId Användarens id (samma som i profiles och auth.users).
 * @returns      All data som behövs för att visa profilen.
 * @throws       Om profilen inte finns, eller om Supabase returnerar ett fel.
 */
export async function fetchProfile(userId: string): Promise<ProfileData> {
  const [profileResult, albumsResult, songResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, banner_url, biography')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('favorite_albums')
      .select('position, spotify_album_id, album_name, artist_name, image_url')
      .eq('user_id', userId)
      .order('position'),
    supabase
      .from('daily_songs')
      .select('id, spotify_track_id, track_name, artist_name, image_url')
      .eq('user_id', userId)
      .eq('song_date', todayInSweden())
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (albumsResult.error) throw albumsResult.error;
  if (songResult.error) throw songResult.error;
  if (!profileResult.data) throw new Error('This profile could not be found.');

  return {
    profile: profileResult.data,
    albums: albumsResult.data,
    todaysSong: songResult.data,
  };
}

/**
 * Bygger en lista med exakt sex platser utifrån favoritalbumen.
 * Platser utan album blir null, så att tomma platser också kan visas.
 *
 * @param albums Favoritalbumen, i valfri ordning.
 * @returns      En lista med ALBUM_SLOTS element, där index 0 är plats 1.
 */
export function toAlbumSlots(albums: FavoriteAlbum[]): (FavoriteAlbum | null)[] {
  return Array.from(
    { length: ALBUM_SLOTS },
    (_, index) => albums.find((album) => album.position === index + 1) ?? null
  );
}