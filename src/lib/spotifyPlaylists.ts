import { supabase } from "@/lib/supabase";

export type SyncResult = {
	ok: boolean;
	results: {group_id: string; ok: boolean; playlistId?: string; tracks?: number; error?: string }[];
};

/**
 * Synkar Spotify-spellistor.
 * - Utan argument: alla grupper den inloggade användaren är med i.
 * - Med groupId: bara den gruppen.
 * Kastar inte vid synkfel, så anroparen kan ignorera det (spellistan
 * hinner ikapp vid nästa synk).
 */
export async function syncPlaylists (groupId?: string): Promise<SyncResult | null> {
	const { data, error } = await supabase.functions.invoke("sync-group-playlist", {
		body: groupId ? { group_id: groupId } : {},
	});
	if (error) {
		console.warn('Spellistesynk misslyckades:', error.message);
		return null;
	}
	return data as SyncResult;
};
