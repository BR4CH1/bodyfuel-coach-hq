/**
 * usePlayerCardDesign — lädt das Karten-Design (Template + Layout)
 * für einen konkreten Verein aus der DB.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlayerCardDesign } from "@/lib/player-cards/design.functions";
import { DEFAULT_LAYOUT, mergeLayout, type PlayerCardLayout } from "@/lib/player-cards/layout";

export function usePlayerCardDesign(
  orgSlug?: string | null,
  opts?: { publishedOnly?: boolean },
): {
  layout: PlayerCardLayout;
  templateUrl: string | null;
  isPublished: boolean;
  name: string | null;
} {
  const fetchFn = useServerFn(getPlayerCardDesign);
  const q = useQuery({
    queryKey: ["player-card-design", orgSlug ?? "__any__"],
    queryFn: () => fetchFn({ data: { orgSlug: orgSlug ?? null } }),
    staleTime: 60_000,
    enabled: orgSlug !== undefined, // Explizit null wird geladen (fallback), undefined = warten
  });
  const d = q.data ?? null;
  const usable = d && (!opts?.publishedOnly || d.is_published);
  return {
    layout: usable ? mergeLayout(d.layout_json) : DEFAULT_LAYOUT,
    templateUrl: usable ? d.template_url ?? null : null,
    isPublished: !!d?.is_published,
    name: d?.name ?? null,
  };
}
