import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_BYTES = 8 * 1024 * 1024; // ~2 min WAV mono 16 bit
const MODEL = "google/gemini-3.5-transcribe";

/**
 * Sprache → Text für den Quick Food Log.
 * Audio wird nur im Arbeitsspeicher durchgereicht, nie gespeichert oder geloggt.
 */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Server misconfigured", { status: 500 });
        const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: user, error } = await sb.auth.getUser(token);
        if (error || !user?.user) return new Response("Unauthorized", { status: 401 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Transkription nicht verfügbar", { status: 503 });

        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES + 4096) return new Response("Aufnahme zu lang", { status: 413 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Ungültige Aufnahme", { status: 400 });
        }
        const file = form.get("file");
        if (!(file instanceof File) || !file.size || file.size > MAX_BYTES || !file.type.startsWith("audio/")) {
          return new Response("Ungültige Aufnahme", { status: 400 });
        }

        const upstream = new FormData();
        upstream.append("model", MODEL);
        upstream.append("file", file, file.name || "recording.wav");
        upstream.append("response_format", "json");
        upstream.append("stream", "true");
        upstream.append("language", "de");
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: upstream,
            signal: request.signal,
          });
          if (!res.ok || !res.body) {
            const msg =
              res.status === 402
                ? "KI-Guthaben aufgebraucht"
                : res.status === 429
                  ? "Zu viele Anfragen – bitte kurz warten"
                  : "Transkription fehlgeschlagen";
            return new Response(msg, { status: res.status || 502 });
          }
          return new Response(res.body, {
            status: 200,
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
          });
        } catch (e) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          return new Response("Transkription fehlgeschlagen", { status: 502 });
        }
      },
    },
  },
});
