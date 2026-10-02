import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

Deno.serve(async (req) => {
  try {
    // Vem anropar? Måste vara inloggad och medlem i gruppen.
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: auth } = await supabase.auth.getUser(jwt);
    if (!auth.user) return new Response("Unauthorized", { status: 401 });

    const { group_id } = await req.json();

    const { data: membership } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", group_id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!membership) return new Response("Forbidden", { status: 403 });

    // Dagens datum i svensk tid (inte UTC), annars blir "idag" fel runt midnatt
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

    const { data: group } = await supabase
      .from("groups")
      .select("id, name, owner_id, spotify_playlist_id")
      .eq("id", group_id)
      .single();
    if (!group) throw new Error("Gruppen hittades inte");

    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", group_id);
    const userIds = (members ?? []).map((m) => m.user_id);

    const { data: songs } = await supabase
      .from("daily_songs")
      .select("spotify_track_id")
      .in("user_id", userIds)
      .eq("song_date", today)
      .order("chosen_at", { ascending: true });
    const uris = (songs ?? []).map((s) => `spotify:track:${s.spotify_track_id}`);

    const token = await getAccessToken(group.owner_id);

    let playlistId = group.spotify_playlist_id as string | null;
    if (!playlistId) {
      const created = await spotify("/me/playlists", token, {
        method: "POST",
        body: JSON.stringify({
          name: `${group.name} – Daily Picks`,
          description: "Dagens låtar från gänget",
          public: false,
        }),
      });
      playlistId = created.id;
      await supabase.from("groups").update({ spotify_playlist_id: playlistId }).eq("id", group_id);
    }

    // Ersätter innehållet med dagens låtar (max 100 per anrop)
    await spotify(`/playlists/${playlistId}/items`, token, {
      method: "PUT",
      body: JSON.stringify({ uris: uris.slice(0, 100) }),
    });

    return Response.json({ ok: true, playlistId, tracks: uris.length });
  } catch (e) {
    console.error(e);
    const notConnected = e instanceof Error && e.message === "NOT_CONNECTED";
    return Response.json(
      { ok: false, error: notConnected ? "NOT_CONNECTED" : "SYNC_FAILED" },
      { status: notConnected ? 409 : 500 }
    );
  }
});