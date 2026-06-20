/**
 * Shared auth check for cron hooks. Accepts EITHER:
 *  - a project-internal `CRON_HOOK_SECRET` via `Authorization: Bearer ...`
 *    or `x-cron-secret` header (legacy), OR
 *  - the Supabase publishable/anon key via `apikey` header
 *    (canonical pattern for /api/public/* cron endpoints).
 *
 * Accepting the anon key lets pg_cron jobs authenticate without depending on
 * a Vault secret that can drift from the deployed CRON_HOOK_SECRET env.
 */
export function verifyCronAuth(request: Request): { ok: true } | { ok: false; response: Response } {
  const cronSecret = process.env.CRON_HOOK_SECRET;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const custom = request.headers.get("x-cron-secret") || "";
  const apiKey = request.headers.get("apikey") || "";

  const matchesSecret =
    !!cronSecret &&
    [bearer, custom, apiKey].some(
      (v) => v.length === cronSecret.length && v === cronSecret,
    );
  const matchesAnon =
    !!anonKey && (apiKey === anonKey || bearer === anonKey || custom === anonKey);

  if (matchesSecret || matchesAnon) return { ok: true };

  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  };
}
