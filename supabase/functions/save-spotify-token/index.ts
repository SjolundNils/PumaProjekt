import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data } = await admin.auth.getUser(jwt);
  if (!data.user) return new Response("Unauthorized", { status: 401 });

  const { access_token, refresh_token } = await req.json();
  if (typeof refresh_token !== "string" || !refresh_token) {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Spotify-token gäller i ca 1 timme. Spara med lite marginal.
  const hasAccess = typeof access_token === "string" && access_token.length > 0;
  const expiresAt = new Date(Date.now() + (hasAccess ? 55 * 60 : 0) * 1000).toISOString();

  const { error } = await admin.from("spotify_tokens").upsert({
    user_id: data.user.id,
    access_token: hasAccess ? access_token : "",
    refresh_token,
    expires_at: expiresAt,
  });
  if (error) {
    console.error(error);
    return Response.json({ ok: false }, { status: 500 });
  }

  await admin.from("profiles").update({ spotify_connected: true }).eq("id", data.user.id);
  return Response.json({ ok: true });
});