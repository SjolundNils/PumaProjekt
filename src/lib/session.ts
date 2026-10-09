import { supabase } from '@/lib/supabase';

export type SessionStatus = 'signed_out' | 'needs_spotify' | 'ready';

/**
 * - signed_out:    ingen Supabase-session
 * - needs_spotify: inloggad i appen men Spotify är inte kopplat (eller har
 *                  slutat gälla), så användaren behöver logga in igen
 * - ready:         allt fungerar
 */

export async function getSessionStatus(): Promise<SessionStatus> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 'signed_out';

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('spotify_connected')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error) throw error;

  return profile?.spotify_connected ? 'ready' : 'needs_spotify';
}

type Listener = (status: SessionStatus) => void;
const listeners = new Set<Listener>();

/** Lyssna på ändringar i inloggningsläget. Returnerar en funktion som avregistrerar. */
export function onSessionStatusChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Kontrollerar läget på nytt och meddelar alla lyssnare (t.ex. rotens vakt).
 * Anropas efter en lyckad inloggning, innan användaren skickas vidare.
 * Går det inte att kontrollera (t.ex. offline) räknas användaren som inloggad,
 * eftersom servern ändå avvisar anrop utan giltig koppling.
 */
export async function refreshSessionStatus(): Promise<SessionStatus> {
  let status: SessionStatus;
  try {
    status = await getSessionStatus();
  } catch {
    status = 'ready';
  }
  listeners.forEach((listener) => listener(status));
  return status;
}