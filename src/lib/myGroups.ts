import { supabase } from '@/lib/supabase';

export type MyGroup = {
  group_id: string;
  name: string;
  avatar_url: string | null;
  member_count: number;
  /** Hur många av medlemmarna som har valt dagens låt. */
  songs_today: number;
  /** Om jag är ägare till gruppen. */
  is_owner: boolean;
};

/** Grupperna jag är med i, med antal medlemmar, antal valda låtar idag och om jag äger dem. */
export async function listMyGroups(): Promise<MyGroup[]> {
  const { data, error } = await supabase.rpc('list_my_groups');
  if (error) throw error;
  return (data ?? []) as MyGroup[];
}