/**
 * CoachPlayerCardView — Player Card für einen bestimmten Athleten,
 * abrufbar durch Coaches / Org-Staff. Nutzt getPlayerCardForAthlete
 * und zeigt die Flip-Card inklusive Recompute + Share.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Share2, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PlayerCard, type PlayerCardData } from "./PlayerCard";
import { PlayerCardBack } from "./PlayerCardBack";
import { PlayerCardFlip } from "./PlayerCardFlip";
import { PlayerCardShareDialog } from "./PlayerCardShareDialog";
import { PlayerCardManualEditor } from "./PlayerCardManualEditor";
import { getPlayerCardForAthlete, recomputePlayerCard, ensurePlayerCardCutout } from "@/lib/player-cards.functions";
import { usePlayerCardDesign } from "@/lib/player-cards/useDesign";

export function CoachPlayerCardView({
  userId,
  jerseyNumber,
  teamLabel,
}: {
  userId: string;
  jerseyNumber?: string | null;
  teamLabel?: string | null;
}) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getPlayerCardForAthlete);
  const recomputeFn = useServerFn(recomputePlayerCard);
  const cutoutFn = useServerFn(ensurePlayerCardCutout);
  const cutoutTriedRef = useRef<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const design = usePlayerCardDesign();

  const q = useQuery({
    queryKey: ["player-card", "athlete", userId],
    queryFn: () => fetchFn({ data: { user_id: userId } }),
  });

  const recompute = useMutation({
    mutationFn: () => recomputeFn({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Player Card aktualisiert");
      qc.invalidateQueries({ queryKey: ["player-card", "athlete", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Aktualisieren"),
  });

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
    };
  }, [q.data, jerseyNumber, teamLabel]);

  // Auto-Freistellen des Profilbilds (idempotent).
  const profileForCutout = (q.data as any)?.profile as
    | { avatar_url?: string | null; avatar_cutout_url?: string | null; avatar_cutout_source?: string | null }
    | undefined;
  useEffect(() => {
    if (!profileForCutout?.avatar_url) return;
    if (
      profileForCutout.avatar_cutout_url &&
      profileForCutout.avatar_cutout_source === profileForCutout.avatar_url
    ) return;
    const key = `${userId}:${profileForCutout.avatar_url}`;
    if (cutoutTriedRef.current === key) return;
    cutoutTriedRef.current = key;
    cutoutFn({ data: { user_id: userId } })
      .then(() => qc.invalidateQueries({ queryKey: ["player-card", "athlete", userId] }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileForCutout?.avatar_url, profileForCutout?.avatar_cutout_source, profileForCutout?.avatar_cutout_url]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bulls-red">
            Player Card
          </div>
          <div className="text-xs text-muted-foreground">
            BodyFuel Rating dieses Athleten
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
            {recompute.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Aktualisieren
          </button>
        </div>
      </div>

      {cardData && (
        <PlayerCardShareDialog data={cardData} open={shareOpen} onClose={() => setShareOpen(false)} />
      )}

      {q.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !cardData ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-bulls-red" />
          <div className="mt-2 text-sm font-semibold">Noch keine Karte erstellt</div>
          <div className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Sobald verifizierte Testwerte vorliegen, kann die Player Card generiert werden.
          </div>
          <button
            type="button"
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {recompute.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Karte generieren
          </button>
        </div>
      ) : (
        <>
          <PlayerCardFlip
            front={<PlayerCard data={cardData} layout={design.layout} templateUrl={design.templateUrl} />}
            back={
              <PlayerCardBack
                data={{ ...cardData, verifiedTests: q.data?.verifiedTests } as any}
                history={(q.data?.history as any[]) ?? []}
                badges={(q.data as any)?.badges}
              />
            }
          />
          {cardData.card.is_provisional && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                Vorläufiges BFR — es fehlen noch Testwerte.
              </div>
            </div>
          )}
          <PlayerCardManualEditor
            userId={userId}
            initialOverrides={(cardData.card as any).manual_overrides ?? {}}
            isPublished={!!(cardData.card as any).is_published}
            invalidateKey={["player-card", "athlete", userId]}
          />
        </>
      )}
    </section>
  );
}
