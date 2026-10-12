import { syncPlaylists } from '@/lib/spotifyPlaylists';
import { supabase } from '@/lib/supabase';

export type GroupInvite = {
  group_id: string;
  group_name: string;
  avatar_url: string | null;
  invited_by: string;
  inviter_name: string | null;
  member_count: number;
  created_at: string;
};

export type InviteState = 'pending' | 'member' | 'none';

/** Mina väntande inbjudningar. */
export async function listGroupInvites(): Promise<GroupInvite[]> {
  const { data, error } = await supabase.rpc('list_my_group_invites');
  if (error) throw error;
  return (data ?? []) as GroupInvite[];
}

/**
 * Accepterar en inbjudan. Personen blir medlem i gruppen, och hens
 * dagens låt (om hen har valt en) läggs i gruppens spellista.
 */
export async function acceptInvite(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_group_invite', { p_group_id: groupId });
  if (error) throw error;

  // Spellistan uppdateras i bakgrunden. Misslyckas den hinner nattjobbet ikapp.
  syncPlaylists(groupId).catch(() => {});
}

/** Nekar en inbjudan. */
export async function declineInvite(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_group_invite', { p_group_id: groupId });
  if (error) throw error;
}

/** Om det finns en väntande inbjudan, om jag redan är medlem, eller inget av det. */
export async function getInviteState(groupId: string): Promise<InviteState> {
  const { data, error } = await supabase.rpc('my_invite_state', { p_group_id: groupId });
  if (error) throw error;
  return (data ?? 'none') as InviteState;
}