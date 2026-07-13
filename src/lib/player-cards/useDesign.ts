/**
 * usePlayerCardDesign — lädt das aktuelle globale Design (Template + Layout)
 * aus der DB und mapped es auf ein `PlayerCardLayout`.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlayerCardDesign } from "@/lib/player-cards/design.functions";
import { DEFAULT_LAYOUT, mergeLayout, type PlayerCardLayout } from "@/lib/player-cards/layout";

export function usePlayerCardDesign(opts?: { publishedOnly?: boolean }): {
  layout: PlayerCardLayout;
  templateUrl: string | null;
  isPublished: boolean;
} {
  const fetchFn = useServerFn(getPlayerCardDesign);
  const q = useQuery({
    queryKey: ["player-card-design"],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });
  const d = q.data ?? null;
  const usable = d && (!opts?.publishedOnly || d.is_published);
  return {
    layout: usable ? mergeLayout(d.layout_json) : DEFAULT_LAYOUT,
    templateUrl: usable ? d.template_url ?? null : null,
    isPublished: !!d?.is_published,
  };
}
