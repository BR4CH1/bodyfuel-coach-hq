import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, X, Sparkles, Heart, Star, ImageIcon } from "lucide-react";
import { generateMealRecipe } from "@/lib/nutrition-plan.functions";
import { generateMealImage, type MealImageStatus } from "@/lib/meal-images.functions";
import {
  toggleFavorite,
  getFavoriteStatus,
  setRating,
  getMyRating,
  logInteraction,
} from "@/lib/meal-feedback.functions";
import { useSession } from "@/lib/bodyfuel/session";
import { MealImageThumb } from "./MealImageThumb";

type Meal = {
  id: string;
  name: string;
  description: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  image_url?: string | null;
  image_status?: MealImageStatus | null;
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function RecipeDialog({
  meal,
  displayName,
  isCoach,
  onClose,
  onImageChanged,
}: {
  meal: Meal;
  displayName: string;
  isCoach: boolean;
  onClose: () => void;
  onImageChanged?: (imageUrl: string | null, status: MealImageStatus) => void;
}) {
  const { supabaseUser } = useSession();
  const generate = useServerFn(generateMealRecipe);
  const generateImage = useServerFn(generateMealImage);
  const toggleFavFn = useServerFn(toggleFavorite);
  const getFavFn = useServerFn(getFavoriteStatus);
  const setRatingFn = useServerFn(setRating);
  const getRatingFn = useServerFn(getMyRating);
  const logFn = useServerFn(logInteraction);

  const isCustomer = !!supabaseUser && !isCoach;

  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(meal.image_url ?? null);
  const [imageStatus, setImageStatus] = useState<MealImageStatus>(meal.image_status ?? "none");
  const [imageBusy, setImageBusy] = useState(false);

  const [favorited, setFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [stars, setStars] = useState<number>(0);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [ratingSaving, setRatingSaving] = useState(false);

  const load = async (force = false) => {
    if (force) setRegenerating(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await generate({ data: { meal_id: meal.id, force } });
      setIngredients(res.ingredients);
      setSteps(res.steps);
    } catch (error) {
      setError(errorMessage(error, "Rezept konnte nicht erstellt werden"));
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    load(false);
    // Load fav + rating state for customers, and log "shown"
    if (isCustomer) {
      (async () => {
        try {
          const [f, r] = await Promise.all([
            getFavFn({ data: { meal_id: meal.id } }),
            getRatingFn({ data: { meal_id: meal.id } }),
          ]);
          setFavorited(f.favorited);
          setStars(r.stars ?? 0);
          setComment(r.comment ?? "");
        } catch {
          /* Favoriten und Bewertung sind Best-Effort. */
        }
        try {
          await logFn({ data: { meal_id: meal.id, kind: "shown" } });
        } catch {
          /* Das Interaktions-Logging darf den Dialog nicht blockieren. */
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal.id]);

  useEffect(() => {
    setImageUrl(meal.image_url ?? null);
    setImageStatus(meal.image_status ?? "none");
  }, [meal.image_status, meal.image_url]);

  useEffect(() => {
    let cancelled = false;
    if (meal.image_url || meal.image_status === "generating") return;

    setImageBusy(true);
    setImageStatus("generating");
    void generateImage({
      data: { target: "plan_meal", meal_id: meal.id, force: false },
    })
      .then((result) => {
        if (cancelled) return;
        setImageUrl(result.image_url ?? null);
        const nextStatus: MealImageStatus =
          result.status === "generated" ||
          result.status === "cached" ||
          result.status === "preserved"
            ? "ready"
            : result.status === "fallback"
              ? "fallback"
              : "failed";
        setImageStatus(nextStatus);
        onImageChanged?.(result.image_url ?? null, nextStatus);
      })
      .catch(() => {
        if (!cancelled) setImageStatus("failed");
      })
      .finally(() => {
        if (!cancelled) setImageBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal.id]);

  const regenerate = async () => {
    try {
      await load(true);
      toast.success("Rezept neu erstellt");
    } catch {
      /* already handled */
    }
  };

  const regenerateImage = async () => {
    setImageBusy(true);
    setImageStatus("generating");
    try {
      const result = await generateImage({
        data: { target: "plan_meal", meal_id: meal.id, force: true },
      });
      setImageUrl(result.image_url ?? null);
      const nextStatus: MealImageStatus =
        result.status === "generated" || result.status === "cached" || result.status === "preserved"
          ? "ready"
          : result.status === "fallback"
            ? "fallback"
            : "failed";
      setImageStatus(nextStatus);
      onImageChanged?.(result.image_url ?? null, nextStatus);
      if (result.image_url) toast.success("Mahlzeitenfoto aktualisiert");
      else toast.error(result.message ?? "Foto konnte nicht erstellt werden");
    } catch (error) {
      setImageStatus("failed");
      toast.error(errorMessage(error, "Foto konnte nicht erstellt werden"));
    } finally {
      setImageBusy(false);
    }
  };

  const handleToggleFav = async () => {
    if (!isCustomer) return;
    setFavBusy(true);
    try {
      const res = await toggleFavFn({ data: { meal_id: meal.id } });
      setFavorited(res.favorited);
      toast.success(res.favorited ? "Zu Favoriten gespeichert ❤️" : "Aus Favoriten entfernt");
    } catch (error) {
      toast.error(errorMessage(error, "Fehler"));
    } finally {
      setFavBusy(false);
    }
  };

  const handleSetStars = async (n: number) => {
    if (!isCustomer) return;
    setStars(n);
    setRatingSaving(true);
    try {
      await setRatingFn({ data: { meal_id: meal.id, stars: n, comment: comment || null } });
      toast.success(`${n} Stern${n === 1 ? "" : "e"} gespeichert`);
    } catch (error) {
      toast.error(errorMessage(error, "Bewertung fehlgeschlagen"));
    } finally {
      setRatingSaving(false);
    }
  };

  const handleSaveComment = async () => {
    if (!isCustomer || !stars) return;
    setRatingSaving(true);
    try {
      await setRatingFn({ data: { meal_id: meal.id, stars, comment: comment || null } });
      toast.success("Kommentar gespeichert");
    } catch (error) {
      toast.error(errorMessage(error, "Fehler"));
    } finally {
      setRatingSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-border bg-card sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Rezept
            </div>
            <div className="font-display text-base font-bold leading-tight">{displayName}</div>
            {meal.description && (
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {meal.description}
              </div>
            )}
            {(meal.kcal != null || meal.protein_g != null) && (
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                {meal.kcal != null && <span>{meal.kcal} kcal</span>}
                {meal.protein_g != null && <span>· P {meal.protein_g}g</span>}
                {meal.carbs_g != null && <span>· KH {meal.carbs_g}g</span>}
                {meal.fat_g != null && <span>· F {meal.fat_g}g</span>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isCustomer && (
              <button
                onClick={handleToggleFav}
                disabled={favBusy}
                className={`rounded-md p-2 transition ${
                  favorited
                    ? "text-rose-500 hover:bg-rose-500/10"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
                aria-label={favorited ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                title={favorited ? "In Favoriten ❤️" : "Zu Favoriten hinzufügen"}
              >
                <Heart className={`h-5 w-5 ${favorited ? "fill-current" : ""}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <MealImageThumb
            name={displayName}
            imageUrl={imageUrl}
            status={imageStatus}
            className="mb-4 h-52 w-full rounded-2xl"
          />
          {!imageUrl && imageStatus === "failed" && (
            <button
              type="button"
              onClick={regenerateImage}
              disabled={imageBusy}
              className="mb-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-gold/50 hover:text-gold"
            >
              {imageBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              Foto erneut erstellen
            </button>
          )}
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
              <span>Rezept wird erstellt…</span>
              <span className="text-[11px]">Das dauert nur beim ersten Mal.</span>
            </div>
          ) : error ? (
            <div className="space-y-3 py-6 text-center text-sm">
              <p className="text-destructive">{error}</p>
              <button
                onClick={() => load(false)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs hover:border-gold/50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <div className="text-xs font-bold uppercase tracking-wider text-gold">Zutaten</div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {ingredients.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold/70" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {steps.length > 0 && (
                <section>
                  <div className="text-xs font-bold uppercase tracking-wider text-gold">
                    Zubereitung
                  </div>
                  <ol className="mt-2 space-y-2 text-sm">
                    {steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-gold">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {isCustomer && (
                <section className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-gold">
                    Wie hat dir dieses Rezept geschmeckt?
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (hoverStars || stars) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={ratingSaving}
                          onMouseEnter={() => setHoverStars(n)}
                          onMouseLeave={() => setHoverStars(0)}
                          onClick={() => handleSetStars(n)}
                          className="p-1"
                          aria-label={`${n} Stern${n === 1 ? "" : "e"}`}
                        >
                          <Star
                            className={`h-6 w-6 transition ${
                              active ? "fill-gold text-gold" : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      );
                    })}
                    {stars > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {stars}/5 gespeichert
                      </span>
                    )}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onBlur={handleSaveComment}
                    placeholder="Was hat dir gefallen oder gefehlt? (optional)"
                    rows={2}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </section>
              )}

              <p className="text-[11px] text-muted-foreground">
                Vorschlag von uns — Mengen können je nach Produkt leicht abweichen.
              </p>
            </div>
          )}
        </div>

        {isCoach && !loading && (
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-border px-4 py-3">
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-accent/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-accent/50 disabled:opacity-60"
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Rezept neu generieren
            </button>
            <button
              onClick={regenerateImage}
              disabled={imageBusy}
              className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-accent/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-accent/50 disabled:opacity-60"
            >
              {imageBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              Foto neu generieren
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
