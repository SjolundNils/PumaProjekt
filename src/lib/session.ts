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

  const { data: profile } = await supabase
    .from('profiles')
    .select('spotify_connected')
    .eq('id', session.user.id)
    .maybeSingle();

  return profile?.spotify_connected ? 'ready' : 'needs_spotify';
}