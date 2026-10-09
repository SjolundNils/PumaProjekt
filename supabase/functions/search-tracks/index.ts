import { createClient } from "@supabase/supabase-js";
import { getAccessToken, NotConnectedError } from "../_shared/spotifyToken.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function searchSpotify(q: string, token: string) {
  const params = new URLSearchParams({ q, type: "track", limit: "10" }); // 10 är Spotifys max
  return fetch("https://api.spotify.com/v1/search?" + params, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Bara de fält från Spotifys svar som vi faktiskt använder
type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists?: { name: string }[];
  album?: {
    name?: string;
    release_date?: string;
    images?: { url: string }[];
  };
};

type SpotifySearchResponse = {
  tracks?: { items?: (SpotifyTrack | null)[] };
};

Deno.serve(async (req) => {
  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data } = await admin.auth.getUser(jwt);
    if (!data.user) return new Response("Unauthorized", { status: 401 });

    const { query } = await req.json().catch(() => ({}));
    const q = typeof query === "string" ? query.trim().slice(0, 100) : "";
    if (q.length < 2) return Response.json({ tracks: [] });

    let token = await getAccessToken(admin, data.user.id);
    let res = await searchSpotify(q, token);

    // Om Spotify ändå nekar nyckeln: förnya en gång och försök igen
    if (res.status === 401) {
      token = await getAccessToken(admin, data.user.id, true);
      res = await searchSpotify(q, token);
    }

    if (res.status === 429) {
      return Response.json(
        { error: "RATE_LIMITED", retry_after: Number(res.headers.get("Retry-After") ?? 1) },
        { status: 429 }
      );
    }
    if (!res.ok) {
      console.error("Spotify-sökning misslyckades:", res.status);
      return Response.json({ error: "SEARCH_FAILED" }, { status: 502 });
    }

    const json = (await res.json()) as SpotifySearchResponse;
    // Skickar bara det appen behöver
    const tracks = (json.tracks?.items ?? [])
      .filter((t): t is SpotifyTrack => t !== null)
      .map((t) => ({
        id: t.id,
        uri: t.uri,
        name: t.name,
        artist_name: (t.artists ?? []).map((a) => a.name).join(", "),
        album_name: t.album?.name ?? null,
        image_url: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? null,
        year: t.album?.release_date?.slice(0, 4) ?? null,
      }));

    return Response.json({ tracks });
  } catch (e) {
    if (e instanceof NotConnectedError) {
      return Response.json({ error: "NOT_CONNECTED" }, { status: 409 });
    }
    console.error(e);
    return Response.json({ error: "SEARCH_FAILED" }, { status: 500 });
  }
});