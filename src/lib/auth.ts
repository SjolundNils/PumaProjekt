/**
 * auth.ts
 *
 * Hanterar inloggning och utloggning i appen via Spotify.
 *
 * Inloggningen sker med OAuth genom Supabase Auth. Flödet är:
 *   1. Appen ber Supabase om en inloggningsadress till Spotify.
 *   2. Adressen öppnas i ett inbyggt webbläsarfönster där användaren
 *      loggar in hos Spotify och godkänner appens behörigheter.
 *   3. Spotify skickar användaren till Supabase, som skapar eller hämtar
 *      användaren och därefter skickar tillbaka till appen via en
 *      redirect-adress som innehåller sessionsnycklarna.
 *   4. Appen läser av nycklarna och etablerar sessionen i Supabase-klienten.
 *
 * Sessionen sparas i AsyncStorage (se supabase.ts), vilket innebär att
 * användaren förblir inloggad mellan appstarter tills hen loggar ut.
 *
 * Första gången en användare loggar in kräver Supabase att e-postadressen
 * bekräftas, eftersom Spotify inte markerar e-postadresser som verifierade.
 * Detta hanteras genom utfallet 'verify_email' nedan.
 */

import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

/**
 * Säkerställer att inloggningsfönstret stängs korrekt när användaren
 * skickas tillbaka till appen. Anropet har främst effekt på webben men
 * är ofarligt på iOS och Android.
 */
WebBrowser.maybeCompleteAuthSession();

/**
 * De Spotify-behörigheter (scopes) som appen begär vid inloggning.
 *
 * - playlist-modify-public:  skapa och ändra offentliga spellistor
 * - playlist-modify-private: skapa och ändra privata spellistor
 * - user-library-modify:     spara spellistor i användarens bibliotek,
 *                            används när en medlem går med i en grupp
 *
 * Om behörigheterna ändras måste befintliga användare logga in igen för
 * att de nya ska gälla.
 */
const SCOPES = 'playlist-modify-public playlist-modify-private user-library-modify';

/**
 * Utfallet av ett inloggningsförsök.
 *
 * - signed_in:    användaren är inloggad. Spotify-nycklarna returneras så
 *                 att de kan sparas på servern för spellistesynken.
 * - verify_email: användarens e-postadress måste bekräftas innan inloggning
 *                 är möjlig. Supabase har skickat ett bekräftelsemejl.
 * - cancelled:    användaren avbröt inloggningen genom att stänga fönstret.
 *
 * Övriga fel kastas som undantag och bör fångas av anroparen.
 */
export type SignInResult =
  | { status: 'signed_in'; providerToken?: string; providerRefreshToken?: string }
  | { status: 'verify_email' }
  | { status: 'cancelled' };

/**
 * Loggar in användaren med Spotify.
 *
 * @returns Ett SignInResult som beskriver hur inloggningen gick.
 * @throws  Om Supabase returnerar ett fel, om Spotify nekar inloggningen
 *          eller om sessionen inte kan etableras.
 */
export async function signInWithSpotify(): Promise<SignInResult> {
  // Adressen som användaren skickas tillbaka till efter inloggningen.
  // I Expo Go blir den exp://<ip>:<port>/--/auth-callback och i en
  // byggd app pumaproject://auth-callback. Båda måste finnas under
  // Redirect URLs i Supabase, annars avvisas omdirigeringen.
  const redirectTo = Linking.createURL('auth-callback');
  console.log('redirectTo:', redirectTo);

  // Hämtar inloggningsadressen till Spotify från Supabase.
  // skipBrowserRedirect: true innebär att Supabase endast returnerar
  // adressen istället för att själv öppna den, eftersom appen öppnar
  // den i ett inbyggt fönster i nästa steg.
  // show_dialog: 'true' gör att Spotify alltid visar sin godkännandesida,
  // där användaren kan se och byta vilket Spotify-konto som används.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'spotify',
    options: {
      redirectTo,
      scopes: SCOPES,
      skipBrowserRedirect: true,
      queryParams: { show_dialog: 'true' },
    },
  });
  if (error) throw error;
  console.log('authUrl:', data.url);

  // Öppnar Spotifys inloggning och väntar tills användaren antingen
  // skickas tillbaka till redirect-adressen eller stänger fönstret.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    return { status: 'cancelled' };
  }

  // Adressen som användaren skickades tillbaka till innehåller antingen
  // sessionsnycklar eller ett felmeddelande.
  const params = readParams(result.url);

  // Första inloggningen: Supabase kräver att e-postadressen bekräftas.
  // Användaren behöver klicka på länken i mejlet och därefter logga in igen.
  if (params.error_code === 'provider_email_needs_verification') {
    return { status: 'verify_email' };
  }

  // Alla övriga fel, till exempel att användaren nekade behörigheterna
  // eller inte finns med under User Management i Spotifys utvecklarpanel.
  if (params.error) {
    throw new Error(params.error_description ?? params.error);
  }

  // Etablerar sessionen i Supabase-klienten. Efter detta är användaren
  // inloggad och alla anrop mot databasen sker i hens namn, vilket är
  // vad RLS-policyerna utgår från via auth.uid().
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (sessionError) throw sessionError;

  // Spotify-nycklarna returneras till anroparen. De hanteras inte av
  // Supabase-sessionen och förnyas inte automatiskt. De ska skickas till
  // en Edge Function som sparar dem i tabellen spotify_tokens.
  return {
    status: 'signed_in',
    providerToken: params.provider_token,
    providerRefreshToken: params.provider_refresh_token,
  };
}

/**
 * Loggar ut användaren.
 *
 * Tar bort sessionen från Supabase-klienten och från AsyncStorage.
 * Spotify-nycklarna i spotify_tokens påverkas inte, så att servern
 * fortsatt kan synka gruppspellistor som användaren äger.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  
}

/**
 * Läser ut parametrar ur en adress.
 *
 * Supabase placerar sessionsnycklar efter # (fragmentet) och fel antingen
 * efter ? (frågesträngen) eller efter #. Båda delarna läses därför och
 * slås samman till ett objekt.
 *
 * @param url Adressen som användaren skickades tillbaka till.
 * @returns   Ett objekt med alla parametrar som nyckel-värde-par.
 *
 * @example
 * readParams('pumaproject://auth-callback#access_token=abc&refresh_token=def')
 * // { access_token: 'abc', refresh_token: 'def' }
 */
function readParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  for (const part of url.split(/[?#]/).slice(1)) {
    new URLSearchParams(part).forEach((value, key) => {
      params[key] = value;
    });
  }

  return params;
}