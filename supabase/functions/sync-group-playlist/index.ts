import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Group = {
  id: string;
  name: string;
  owner_id: string;
  spotify_playlist_id: string | null;
};

async function getAccessToken(userId: string): Promise<string> {
  const { data: row } = await supabase
    .from("spotify_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();
  if (!row) throw new Error("NOT_CONNECTED");

  // Återanvänd access token om den är giltig i minst en minut till
  if (row.access_token && new Date(row.expires_at).getTime() > Date.now() + 60_000) {
    return row.access_token;
  }

  const id = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const secret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${id}:${secret}`),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });
  if (!res.ok) throw new Error("NOT_CONNECTED");
  const data = await res.json();

  await supabase
    .from("spotify_tokens")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? row.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return data.access_token;
}

async function spotify(path: string, token: string, init: RequestInit = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.spotify.com/v1" + path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (res.status === 429) {
      await sleep(Number(res.headers.get("Retry-After") ?? 1) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
  throw new Error("Rate limited");
}

// Synkar en enda grupps spellista. Skapar den om den inte finns.
async function syncGroup(
  group: Group,
  uris: string[],
  tokenFor: (userId: string) => Promise<string>
) {
  const token = await tokenFor(group.owner_id);

  const createPlaylist = async (): Promise<string> => {
    const created = await spotify("/me/playlists", token, {
      method: "POST",
      body: JSON.stringify({
        name: `${group.name} – Daily Picks`,
        description: "Dagens låtar från gänget",
        public: false,
      }),
    });
    await supabase
      .from("groups")
      .update({ spotify_playlist_id: created.id })
      .eq("id", group.id);
    return created.id;
  };

  const replaceItems = (playlistId: string) =>
    spotify(`/playlists/${playlistId}/items`, token, {
      method: "PUT",
      body: JSON.stringify({ uris: uris.slice(0, 100) }),
    });

  let playlistId = group.spotify_playlist_id ?? (await createPlaylist());
  try {
    await replaceItems(playlistId);
  } catch (e) {
    // Om Spotify svarar 404 finns spellistan inte längre: skapa en ny
    if (e instanceof Error && e.message.startsWith("404")) {
      playlistId = await createPlaylist();
      await replaceItems(playlistId);
    } else {
      throw e;
    }
  }
  return playlistId;
}

Deno.serve(async (req) => {
  try {
    // Vem anropar? Måste vara inloggad och medlem i gruppen.
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: auth } = await supabase.auth.getUser(jwt);
    if (!auth.user) return new Response("Unauthorized", { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requestedGroupId: string | undefined = body.group_id;

	// Vilka grupper är användaren med i? (Det är bara de hen får synka.)
    const { data: myMemberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", auth.user.id);
    let groupIds = (myMemberships ?? []).map((m) => m.group_id as string);

	if (requestedGroupId) {
      if (!groupIds.includes(requestedGroupId)) {
        return new Response("Forbidden", { status: 403 });
      }
      groupIds = [requestedGroupId];
    }
    if (groupIds.length === 0) return Response.json({ ok: true, results: [] });

    // Dagens datum i svensk tid (inte UTC), annars blir "idag" fel runt midnatt
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

	// Hämta grupper, medlemmar och dagens låtar i så få frågor som möjligt
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name, owner_id, spotify_playlist_id")
      .in("id", groupIds);

    const { data: allMembers } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds);

    const allUserIds = [...new Set((allMembers ?? []).map((m) => m.user_id as string))];
    const { data: songs } = await supabase
      .from("daily_songs")
      .select("user_id, spotify_track_id")
      .in("user_id", allUserIds)
      .eq("song_date", today)
      .order("chosen_at", { ascending: true });
	
    // En token per ägare räcker, även om hen äger flera grupper
    const tokens = new Map<string, Promise<string>>();
    const tokenFor = (userId: string) => {
      if (!tokens.has(userId)) tokens.set(userId, getAccessToken(userId));
      return tokens.get(userId)!;
    };

    // Synka grupp för grupp. Ett fel i en grupp stoppar inte de andra.
    const results = [];
    for (const group of (groups ?? []) as Group[]) {
      try {
        const memberIds = new Set(
          (allMembers ?? []).filter((m) => m.group_id === group.id).map((m) => m.user_id)
        );
        const uris = (songs ?? [])
          .filter((s) => memberIds.has(s.user_id))
          .map((s) => `spotify:track:${s.spotify_track_id}`);

        const playlistId = await syncGroup(group, uris, tokenFor);
        results.push({ group_id: group.id, ok: true, playlistId, tracks: uris.length });
      } catch (e) {
        console.error("Synk misslyckades för grupp", group.id, e);
        const notConnected = e instanceof Error && e.message === "NOT_CONNECTED";
        results.push({
          group_id: group.id,
          ok: false,
          error: notConnected ? "NOT_CONNECTED" : "SYNC_FAILED",
        });
      }
    }

    return Response.json({ ok: results.every((r) => r.ok), results });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: "SYNC_FAILED" }, { status: 500 });
  }
});