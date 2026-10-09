
export type SessionStatus = 'signed_out' | 'needs_spotify' | 'ready';

/**
 * - signed_out:    ingen Supabase-session
 * - needs_spotify: inloggad i appen men Spotify är inte kopplat (eller har
 *                  slutat gälla), så användaren behöver logga in igen
 * - ready:         allt fungerar
 */