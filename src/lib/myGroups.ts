import { supabase } from '@/lib/supabase';

export type MyGroup = {
  group_id: string;
  name: string;
  avatar_url: string | null;
  member_count: number;
  /** Hur många av medlemmarna som har valt dagens låt. */
  songs_today: number;
};

/** Grupperna jag är med i, med antal medlemmar och antal valda låtar idag. */
export async function listMyGroups(): Promise<MyGroup[]> {
  const { data, error } = await supabase.rpc('list_my_groups');
  if (error) throw error;
  return (data ?? []) as MyGroup[];
}