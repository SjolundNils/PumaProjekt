/**
 * spotifyLinks.ts
 *
 * Bygger länkar till låtar, album och spellistor på open.spotify.com.
 * Alla länkar i appen ska skapas här, så att formatet finns på ett ställe.
 *
 * Funktionerna returnerar null om id:t saknas eller ser konstigt ut, och
 * SpotifyButton visar ingenting när den får null.
 */

// Spotify-id:n består av bokstäver och siffror. Allt annat avvisas.

import { Alert, Linking } from 'react-native';

const SPOTIFY_ID = /^[A-Za-z0-9]{10,30}$/;

function build(kind: 'track' | 'album' | 'playlist', id: string | null | undefined) {
  return id && SPOTIFY_ID.test(id) ? `https://open.spotify.com/${kind}/${id}` : null;
}

export const spotifyTrackUrl = (id: string | null | undefined) => build('track', id);
export const spotifyAlbumUrl = (id: string | null | undefined) => build('album', id);
export const spotifyPlaylistUrl = (id: string | null | undefined) => build('playlist', id);

/** Öppnar en Spotify-länk (i appen om den finns, annars webben). Visar ett fel om det misslyckas. */
export async function openInSpotify(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open Spotify', 'Try again in a moment.');
  }
}