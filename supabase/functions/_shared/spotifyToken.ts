// deno-lint-ignore no-explicit-any
type Db = any;

export class NotConnectedError extends Error {
  constructor() {
    super("NOT_CONNECTED");
  }
}

/**
 * Ger en giltig Spotify access token för användaren.
 * Återanvänder den sparade om den gäller minst en minut till, annars förnyas
 * den med refresh token. force = true förnyar alltid.
 */
export async function getAccessToken(db: Db, userId: string, force = false): Promise<string> {
  const { data: row } = await db
    .from("spotify_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || !row.refresh_token) throw new NotConnectedError();

  if (!force && row.access_token && new Date(row.expires_at).getTime() > Date.now() + 60_000) {
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

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // invalid_grant = användaren har tagit bort appens åtkomst, eller så har
    // refresh token slutat gälla. Då hjälper bara en ny inloggning.
    if (res.status === 400 && body.error === "invalid_grant") {
      await db.from("spotify_tokens").delete().eq("user_id", userId);
      await db.from("profiles").update({ spotify_connected: false }).eq("id", userId);
      throw new NotConnectedError();
    }
    // Annat fel (t.ex. Spotify nere): markera inte användaren som frånkopplad
    throw new Error(`SPOTIFY_TOKEN_${res.status}`);
  }

  const data = await res.json();
  await db
    .from("spotify_tokens")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? row.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return data.access_token;
}