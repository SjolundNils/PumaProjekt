import { supabase } from '@/lib/supabase';

export type TrackHit = {
  id: string;
  uri: string;
  name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  year: string | null;
};

/** Kastas när användarens Spotify-koppling saknas eller har slutat gälla. */
export class SpotifyNotConnectedError extends Error {
  constructor() {
    super('Spotify är inte kopplat');
  }
}

/** Söker låtar via servern. Max 10 träffar. */
export async function searchTracks(query: string): Promise<TrackHit[]> {
  const { data, error } = await supabase.functions.invoke('search-tracks', { body: { query } });

  if (error) {
    // Vid fel från funktionen ligger själva svaret i error.context
    const status = (error as any).context?.status;
    if (status === 409) throw new SpotifyNotConnectedError();
    if (status === 429) throw new Error('För många sökningar, vänta en stund.');
    throw new Error('Sökningen misslyckades.');
  }
  return (data?.tracks ?? []) as TrackHit[];
}