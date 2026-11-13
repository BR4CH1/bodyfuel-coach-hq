import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://bodyfuel-coaching.com";
// Nur öffentliche, für Besucher gedachte Seiten (keine Login-/App-Bereiche).
const PUBLIC_PATHS = ["/", "/smart", "/trial", "/continental-challenge", "/trust", "/impressum", "/datenschutz"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = PUBLIC_PATHS.map((p) => `<url><loc>${BASE_URL}${p === "/" ? "/" : p}</loc></url>`).join("");
        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
