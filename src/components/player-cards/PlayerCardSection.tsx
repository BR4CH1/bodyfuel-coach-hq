/**
 * PlayerCardSection — komplette Karte inkl. Datenladung, Recompute-Button.
 * Kann direkt in Athletenprofile eingebunden werden.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Sparkles, AlertCircle, Share2, Award } from "lucide-react";
import { PlayerCard, type PlayerCardData } from "./PlayerCard";
import { PlayerCardBack } from "./PlayerCardBack";
import { PlayerCardFlip } from "./PlayerCardFlip";
import { PlayerCardShareDialog } from "./PlayerCardShareDialog";
import { PlayerCardUpgradeOverlay, type UpgradePayload } from "./PlayerCardUpgradeOverlay";
import { getMyPlayerCard, recomputePlayerCard, markBadgeUnlocksSeen, ensurePlayerCardCutout } from "@/lib/player-cards.functions";
import { usePlayerCardDesign } from "@/lib/player-cards/useDesign";
import { toast } from "sonner";

const TEST_LABELS: Record<string, string> = {
  sprint_10yd: "10 Yard Sprint",
  sprint_40yd: "40 Yard Dash",
  broad_jump: "Broad Jump",
  cmj_height: "Countermovement Jump",
  bench_press_5rm: "Bench Press 5RM",
  trap_bar_5rm: "Trap Bar 5RM",
  a505_left: "Adapted 505 links",
  a505_right: "Adapted 505 rechts",
  a505_avg: "Adapted 505 (Ø)",
  rast_6x35m: "RAST 6 × 35 m",
};

export function PlayerCardSection({ jerseyNumber, teamLabel }: { jerseyNumber?: string | null; teamLabel?: string | null }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getMyPlayerCard);
  const recomputeFn = useServerFn(recomputePlayerCard);
  const markSeenFn = useServerFn(markBadgeUnlocksSeen);
  const cutoutFn = useServerFn(ensurePlayerCardCutout);
  const cutoutTriedRef = useRef<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [upgrade, setUpgrade] = useState<UpgradePayload | null>(null);
  const previousUnlockedRef = useRef<Set<string> | null>(null);

  const q = useQuery({
    queryKey: ["player-card", "me"],
    queryFn: () => fetchFn(),
  });
  const orgSlug = (q.data as any)?.organization?.slug ?? null;
  const design = usePlayerCardDesign(orgSlug, { publishedOnly: true });


  const recompute = useMutation({
    mutationFn: () => recomputeFn({ data: {} }),
    onSuccess: (res: any) => {
      toast.success("Player Card aktualisiert");
      qc.invalidateQueries({ queryKey: ["player-card", "me"] });
      if (res?.upgrade) setUpgrade(res.upgrade as UpgradePayload);
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Aktualisieren"),
  });

  // Neue Badges als Toast anzeigen + nach kurzer Zeit als gesehen markieren.
  const badges = (q.data as any)?.badges as
    | { definitions: any[]; unlocks: any[] }
    | undefined;
  useEffect(() => {
    if (!badges) return;
    const currentKeys = new Set<string>(badges.unlocks.map((u: any) => u.badge_key));
    const previous = previousUnlockedRef.current;
    previousUnlockedRef.current = currentKeys;
    if (!previous) return; // erster Load — kein Toast
    const newlyUnlocked = badges.unlocks.filter(
      (u: any) => !previous.has(u.badge_key) && !u.seen_at,
    );
    if (newlyUnlocked.length === 0) return;
    const defsByKey = new Map<string, any>(
      badges.definitions.map((d: any) => [d.key, d]),
    );
    for (const u of newlyUnlocked) {
      const def = defsByKey.get(u.badge_key);
      if (!def) continue;
      toast.success(`Neues Badge: ${def.label}`, {
        description: def.description,
        icon: <Award className="h-4 w-4" />,
      });
    }
    // Nach 6 s als gesehen markieren, damit die Pulse-Animation stoppt.
    const keys = newlyUnlocked.map((u: any) => u.badge_key);
    const timer = setTimeout(() => {
      markSeenFn({ data: { badge_keys: keys } })
        .then(() => qc.invalidateQueries({ queryKey: ["player-card", "me"] }))
        .catch(() => {});
    }, 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges?.unlocks]);

  // Auto-Freistellen des Profilbilds für die Player Card (idempotent, einmal pro avatar_url).
  const profileForCutout = (q.data as any)?.profile as
    | { avatar_url?: string | null; avatar_cutout_url?: string | null; avatar_cutout_source?: string | null }
    | undefined;
  useEffect(() => {
    if (!profileForCutout?.avatar_url) return;
    if (
      profileForCutout.avatar_cutout_url &&
      profileForCutout.avatar_cutout_source === profileForCutout.avatar_url
    ) return;
    if (cutoutTriedRef.current === profileForCutout.avatar_url) return;
    cutoutTriedRef.current = profileForCutout.avatar_url;
    cutoutFn({ data: {} })
      .then(() => qc.invalidateQueries({ queryKey: ["player-card", "me"] }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileForCutout?.avatar_url, profileForCutout?.avatar_cutout_source, profileForCutout?.avatar_cutout_url]);


  const cardData = useMemo<PlayerCardData | null>(() => {
    const bundle = q.data;
    if (!bundle?.card) return null;
    return {
      card: bundle.card as any,
      profile: bundle.profile as any,
      bullsProfile: bundle.bullsProfile as any,
      organization: bundle.organization as any,
      jerseyNumber,
      teamLabel,
      history: (bundle.history as any[]) ?? [],
    };
  }, [q.data, jerseyNumber, teamLabel]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bulls-red">
            Player Card
          </div>
          <div className="text-xs text-muted-foreground">
            Deine BodyFuel-Rating-Karte — automatisch aus verifizierten Tests
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {cardData && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-bulls-red/60 hover:text-white"
            >
              <Share2 className="h-3.5 w-3.5" />
              Teilen
            </button>
          )}
          <button
            type="button"
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-bulls-red/60 hover:text-white disabled:opacity-50"
          >
            {recompute.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Aktualisieren
          </button>
        </div>
      </div>

      {cardData && (
        <PlayerCardShareDialog data={cardData} open={shareOpen} onClose={() => setShareOpen(false)} />
      )}

      {upgrade && <PlayerCardUpgradeOverlay upgrade={upgrade} onClose={() => setUpgrade(null)} />}


      {q.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !cardData || !(cardData.card as any).is_published ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-bulls-red" />
          <div className="mt-2 text-sm font-semibold">Deine Karte wird gerade vom Coach vorbereitet</div>
          <div className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Sobald dein Coach die Werte eingetragen und die Karte freigegeben hat, erscheint sie hier.
          </div>
        </div>
      ) : (
        <>
          <PlayerCardFlip
            front={<PlayerCard data={cardData} layout={design.layout} templateUrl={design.templateUrl} />}
            back={
              <PlayerCardBack
                data={{ ...cardData, verifiedTests: q.data?.verifiedTests } as any}
                history={(q.data?.history as any[]) ?? []}
                badges={badges}
              />
            }
          />
          {cardData.card.is_provisional && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                Vorläufiges BFR
              </div>
              <div className="mt-1 text-amber-100/80">
                Es fehlen noch Testwerte. Sobald diese verifiziert sind, wird dein BFR präziser.
              </div>
              {q.data?.card?.missing_tests && (q.data.card.missing_tests as string[]).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(q.data.card.missing_tests as string[]).map((k) => (
                    <span key={k} className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px]">
                      {TEST_LABELS[k] ?? k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
