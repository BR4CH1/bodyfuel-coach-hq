import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, Eye, EyeOff, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/coach/reviews")({
  head: () => ({ meta: [{ title: "App-Bewertungen — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachReviewsPage />
    </AppLayout>
  ),
});

type Review = {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  publish_with_name: boolean;
  first_name: string | null;
  approved_for_public: boolean;
  hidden: boolean;
  created_at: string;
  profile_name?: string | null;
};

function CoachReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_reviews")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Review[];
    // Profilnamen nachladen
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
      list.forEach((r) => (r.profile_name = map.get(r.user_id) ?? null));
    }
    setReviews(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (
    r: Review,
    patch: Partial<Pick<Review, "hidden" | "approved_for_public">>,
  ) => {
    const { error } = await supabase
      .from("app_reviews")
      .update(patch)
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Aktualisiert");
    setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
  };

  const avg =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)
      : "—";
  const publicCount = reviews.filter(
    (r) => r.publish_with_name && r.approved_for_public && !r.hidden,
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">App-Bewertungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Bewertungen deiner User. Du kannst einzelne ausblenden oder die
          öffentliche Anzeige steuern.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Bewertungen" value={String(reviews.length)} />
        <StatTile label="Ø Sterne" value={avg} />
        <StatTile label="Öffentlich" value={String(publicCount)} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade …
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-50" />
          Noch keine Bewertungen.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <article
              key={r.id}
              className={`rounded-2xl border p-5 ${
                r.hidden
                  ? "border-border bg-card/40 opacity-60"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1 text-gold">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < r.rating ? "fill-current" : "opacity-30"
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    {r.profile_name ?? "Unbekannter User"}
                    {r.publish_with_name && r.first_name && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (öffentlich als „{r.first_name}")
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.publish_with_name ? (
                    <Badge className="bg-gold/15 text-gold hover:bg-gold/15">
                      Teilen erlaubt
                    </Badge>
                  ) : (
                    <Badge variant="outline">Nur intern</Badge>
                  )}
                  {r.hidden && <Badge variant="destructive">Ausgeblendet</Badge>}
                  {!r.approved_for_public && !r.hidden && (
                    <Badge variant="outline">Nicht freigegeben</Badge>
                  )}
                </div>
              </div>

              {r.comment && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background/40 p-3 text-sm">
                  {r.comment}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={r.hidden ? "default" : "outline"}
                  onClick={() => toggle(r, { hidden: !r.hidden })}
                >
                  {r.hidden ? (
                    <>
                      <Eye className="mr-1 h-4 w-4" /> Wieder einblenden
                    </>
                  ) : (
                    <>
                      <EyeOff className="mr-1 h-4 w-4" /> Ausblenden
                    </>
                  )}
                </Button>
                {r.publish_with_name && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toggle(r, { approved_for_public: !r.approved_for_public })
                    }
                  >
                    {r.approved_for_public
                      ? "Öffentliche Anzeige stoppen"
                      : "Für Website freigeben"}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <div className="font-display text-2xl font-bold text-gold">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
