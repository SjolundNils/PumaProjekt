/**
 * set-playlist-cover
 *
 * Sätter gruppens bild som omslag på gruppens spellista i Spotify.
 *
 * Anropas av appen efter att gruppen och spellistan har skapats:
 *   supabase.functions.invoke('set-playlist-cover', { body: { groupId } })
 *
 * Bara gruppens ägare får anropa funktionen, eftersom spellistan ligger på
 * ägarens Spotify-konto. Bilden hämtas från groups.avatar_url och skickas
 * till Spotify som base64-kodad JPEG. Spotify kräver att bilden är under
 * 256 kB, vilket appen redan ser till när bilden väljs.
 *
 * Kräver Spotify-behörigheten ugc-image-upload.
 */

import { createClient } from "@supabase/supabase-js";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { getAccessToken, NotConnectedError } from "../_shared/spotifyToken.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    // Kontrollerar vem som anropar.
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(jwt);
    if (!userData.user) return new Response("Unauthorized", { status: 401 });
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const groupId = typeof body.groupId === "string" ? body.groupId : null;
    if (!groupId) return Response.json({ error: "MISSING_GROUP_ID" }, { status: 400 });

    // Hämtar gruppen och kontrollerar att anroparen är ägaren.
    const { data: group } = await admin
      .from("groups")
      .select("owner_id, spotify_playlist_id, avatar_url")
      .eq("id", groupId)
      .maybeSingle();

    if (!group) return Response.json({ error: "GROUP_NOT_FOUND" }, { status: 404 });
    if (group.owner_id !== userId) return Response.json({ error: "NOT_OWNER" }, { status: 403 });
    if (!group.avatar_url) return Response.json({ error: "NO_IMAGE" }, { status: 400 });
    if (!group.spotify_playlist_id) {
      return Response.json({ error: "NO_PLAYLIST" }, { status: 409 });
    }

    // Hämtar bilden och gör om den till base64, som Spotify kräver.
    const imageResponse = await fetch(group.avatar_url);
    if (!imageResponse.ok) {
      return Response.json({ error: "IMAGE_FETCH_FAILED" }, { status: 502 });
    }
    const imageBase64 = encodeBase64(new Uint8Array(await imageResponse.arrayBuffer()));

    // Skickar bilden till Spotify. Vid 401 förnyas nyckeln och anropet
    // görs en gång till, samma upplägg som i spotify-data.
    const upload = (token: string) =>
      fetch(`https://api.spotify.com/v1/playlists/${group.spotify_playlist_id}/images`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "image/jpeg",
        },
        body: imageBase64,
      });

    let res = await upload(await getAccessToken(admin, userId));
    if (res.status === 401) {
      res = await upload(await getAccessToken(admin, userId, true));
    }

    if (!res.ok) {
      // 403 betyder oftast att behörigheten ugc-image-upload saknas,
      // och att ägaren behöver logga in igen.
      console.error("Spotify-fel vid omslag:", res.status, await res.text());
      return Response.json({ error: "SPOTIFY_FAILED", status: res.status }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof NotConnectedError) {
      return Response.json({ error: "NOT_CONNECTED" }, { status: 409 });
    }
    console.error(e);
    return Response.json({ error: "FAILED" }, { status: 500 });
  }
});