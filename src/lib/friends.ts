import { supabase } from '@/lib/supabase';

export type Relation = 'none' | 'friends' | 'sent' | 'received';

export type ProfileHit = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  relation: Relation;
};

export type Friendship = {
  friendship_id: number;
  friend_id: string;
  display_name: string | null;
  avatar_url: string | null;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  created_at: string;
  accepted_at: string | null;
};

/** Söker användare på visningsnamn (minst 2 tecken). */
export async function searchUsers(query: string): Promise<ProfileHit[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('search_profiles', { q: query });
  if (error) throw error;
  return (data ?? []) as ProfileHit[];
}

/**
 * Skickar en vänförfrågan.
 * Returnerar: 'sent' | 'accepted' (den andra hade redan skickat till dig)
 *             | 'already_sent' | 'already_friends'
 */
export async function sendFriendRequest(userId: string) {
  const { data, error } = await supabase.rpc('send_friend_request', { target: userId });
  if (error) throw error;
  return data as 'sent' | 'accepted' | 'already_sent' | 'already_friends';
}

/** Hämtar alla mina vänskaper (både accepterade och väntande). */
export async function listFriendships(): Promise<Friendship[]> {
  const { data, error } = await supabase.rpc('list_friendships');
  if (error) throw error;
  return (data ?? []) as Friendship[];
}

export async function getFriends() {
  return (await listFriendships()).filter((f) => f.status === 'accepted');
}
export async function getIncomingRequests() {
  return (await listFriendships()).filter((f) => f.status === 'pending' && f.direction === 'incoming');
}
export async function getOutgoingRequests() {
  return (await listFriendships()).filter((f) => f.status === 'pending' && f.direction === 'outgoing');
}

/** Accepterar en inkommande förfrågan. Bara mottagaren kan göra det. */
export async function acceptRequest(friendshipId: number) {
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Förfrågan hittades inte');
}

/** Avböjer, drar tillbaka en förfrågan eller tar bort en vän. Samma sak i databasen. */
export async function removeFriendship(friendshipId: number) {
  const { data, error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Vänskapen hittades inte');
}