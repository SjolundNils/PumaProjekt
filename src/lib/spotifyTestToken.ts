/**
 * spotifyTestToken.ts
 *
 * TILLFÄLLIG LÖSNING FÖR TEST. Ska ersättas innan appen är klar.
 *
 * Sparar Spotify-nyckeln (provider_token) som returneras vid inloggning,
 * så att testskärmar kan anropa Spotify Web API direkt från appen.
 *
 * Begränsningar:
 *   - Nyckeln är giltig i cirka en timme och förnyas inte.
 *   - Nyckeln finns bara efter en ny inloggning. När appen startas om med
 *     en sparad Supabase-session finns ingen ny nyckel att spara.
 *
 * I den slutliga lösningen sker Spotify-anrop via Edge Functions, och
 * nycklarna lagras i tabellen spotify_tokens på servern.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'test_spotify_provider_token';

/** Sparar Spotify-nyckeln efter inloggning. */
export async function saveSpotifyTestToken(token: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, token);
}

/** Hämtar den sparade Spotify-nyckeln, eller null om ingen finns. */
export async function getSpotifyTestToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}