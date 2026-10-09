import { SpotifyNotConnectedError } from '@/lib/spotifySearch';
import { supabase } from '@/lib/supabase';

export type SpotifyProfileData = { display_name: string | null; image_url: string | null };
export type AlbumHit = { id: string; album_name: string; artist_name: string; image_url: string | null };
export type RecentTrack = {
  id: string;
  played_at: string;
  name: string;
  artist_name: string;
  image_url: string | null;
};

/** Anropar Edge Function spotify-data och översätter felen. */
async function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('spotify-data', {
    body: { action, ...params },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 409) throw new SpotifyNotConnectedError();
    if (status === 429) throw new Error('För många anrop, vänta en stund.');
    if (status === 403) throw new Error('Spotify nekade åtkomsten. Logga ut och in igen.');
    throw new Error('Kunde inte hämta data från Spotify.');
  }
  return data as T;
}

/** Den inloggade användarens Spotify-namn och profilbild. */
export const getSpotifyProfile = () => call<SpotifyProfileData>('me');

/** Söker album (max 10 träffar). */
export async function searchAlbums(query: string): Promise<AlbumHit[]> {
  const data = await call<{ albums: AlbumHit[] }>('search_albums', { query });
  return data.albums;
}

/** De 5 senast spelade låtarna. */
export async function getRecentlyPlayed(): Promise<RecentTrack[]> {
  const data = await call<{ tracks: RecentTrack[] }>('recently_played');
  return data.tracks;
}