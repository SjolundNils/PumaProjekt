import { createClient } from "@supabase/supabase-js";
import { getAccessToken, NotConnectedError } from "../_shared/spotifyToken.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Bara de fält från Spotifys svar som vi använder
type Image = { url: string };
type Artist = { name: string };
type SpotifyMe = { display_name?: string | null; images?: Image[] };
type SpotifyAlbum = { id: string; name: string; artists?: Artist[]; images?: Image[] };
type SpotifyAlbumSearch = { albums?: { items?: (SpotifyAlbum | null)[] } };
type SpotifyRecent = {
  items?: {
    played_at: string;
    track?: { id: string; name: string; artists?: Artist[]; album?: { images?: Image[] } } | null;
  }[];
};

// Anropar Spotify med användarens token. Förnyar och försöker en gång till vid 401.
async function spotifyGet(userId: string, path: string): Promise<Response> {
  const call = (token: string) =>
    fetch("https://api.spotify.com/v1" + path, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let res = await call(await getAccessToken(admin, userId));
  if (res.status === 401) {
    res = await call(await getAccessToken(admin, userId, true));
  }
  return res;
}

// Översätter ett misslyckat Spotify-svar till ett svar till appen
function fail(res: Response): Response {
  if (res.status === 429) {
    return Response.json(
      { error: "RATE_LIMITED", retry_after: Number(res.headers.get("Retry-After") ?? 1) },
      { status: 429 }
    );
  }
  // 403 = saknad behörighet (scope) eller konto utanför allowlisten
  if (res.status === 403) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  console.error("Spotify-fel:", res.status);
  return Response.json({ error: "SPOTIFY_FAILED" }, { status: 502 });
}

Deno.serve(async (req) => {
  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data } = await admin.auth.getUser(jwt);
    if (!data.user) return new Response("Unauthorized", { status: 401 });
    const userId = data.user.id;

    const body = await req.json().catch(() => ({}));

    switch (body.action) {
      case "me": {
        const res = await spotifyGet(userId, "/me");
        if (!res.ok) return fail(res);
        const me = (await res.json()) as SpotifyMe;
        return Response.json({
          display_name: me.display_name || null,
          image_url: me.images?.[0]?.url ?? null,
        });
      }

      case "search_albums": {
        const q = typeof body.query === "string" ? body.query.trim().slice(0, 100) : "";
        if (q.length < 2) return Response.json({ albums: [] });

        const params = new URLSearchParams({ q, type: "album", limit: "10" });
        const res = await spotifyGet(userId, "/search?" + params);
        if (!res.ok) return fail(res);

        const json = (await res.json()) as SpotifyAlbumSearch;
        const albums = (json.albums?.items ?? [])
          .filter((a): a is SpotifyAlbum => a !== null)
          .map((a) => ({
            id: a.id,
            album_name: a.name,
            artist_name: (a.artists ?? []).map((x) => x.name).join(", "),
            image_url: a.images?.[0]?.url ?? null,
          }));
        return Response.json({ albums });
      }

      case "recently_played": {
        const res = await spotifyGet(userId, "/me/player/recently-played?limit=5");
        if (!res.ok) return fail(res);

        const json = (await res.json()) as SpotifyRecent;
        const tracks = (json.items ?? [])
          .filter((item) => item.track)
          .map((item) => ({
            id: item.track!.id,
            played_at: item.played_at,
            name: item.track!.name,
            artist_name: (item.track!.artists ?? []).map((x) => x.name).join(", "),
            image_url:
              item.track!.album?.images?.[1]?.url ?? item.track!.album?.images?.[0]?.url ?? null,
          }));
        return Response.json({ tracks });
      }

      default:
        return Response.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof NotConnectedError) {
      return Response.json({ error: "NOT_CONNECTED" }, { status: 409 });
    }
    console.error(e);
    return Response.json({ error: "FAILED" }, { status: 500 });
  }
});