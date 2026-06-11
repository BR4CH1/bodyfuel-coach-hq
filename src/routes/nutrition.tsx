import { createFileRoute } from "@tanstack/react-router";
import { FileText, Download, Upload, Archive } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";

export const Route = createFileRoute("/nutrition")({
  head: () => ({ meta: [{ title: "Ernährungsplan — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <NutritionContent />
    </AppLayout>
  ),
});

function NutritionContent() {
  const { user } = useSession();
  if (!user) return null;
  const current = user.plans.find((p) => p.current);
  const archive = user.plans.filter((p) => !p.current);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ernährung</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Dein Plan</h1>
        </div>
        <button
          onClick={() => toast("PDF-Upload (Demo)")}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-gold hover:opacity-90"
        >
          <Upload className="h-4 w-4" /> Plan hochladen
        </button>
      </div>

      {/* Current plan */}
      {current && (
        <div className="overflow-hidden rounded-3xl border border-gold/40 bg-card">
          <div className="border-b border-gold/30 bg-accent/30 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
              <FileText className="h-3.5 w-3.5" /> Aktueller Plan
            </div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">{current.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aktiv seit {new Date(current.date).toLocaleDateString("de-DE")}
                </p>
              </div>
              <button
                onClick={() => toast("Download startet (Demo)")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                <Download className="h-4 w-4" /> PDF herunterladen
              </button>
            </div>
          </div>
          {/* Mock PDF preview */}
          <div className="grid place-items-center bg-gradient-to-b from-secondary/40 to-background p-10">
            <div className="relative aspect-[3/4] w-full max-w-xs rounded-lg border border-border bg-background shadow-xl">
              <div className="absolute inset-0 flex flex-col p-6">
                <div className="font-display text-sm font-bold tracking-wider text-gold">
                  BODYFUEL
                </div>
                <div className="mt-2 font-display text-lg font-bold">{current.name}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Personalisiert für {user.name}
                </div>
                <div className="mt-6 space-y-2">
                  {["Frühstück", "Snack", "Mittagessen", "Snack", "Abendessen"].map((m) => (
                    <div
                      key={m}
                      className="flex items-center justify-between border-b border-border pb-1.5 text-xs"
                    >
                      <span className="text-foreground">{m}</span>
                      <span className="text-muted-foreground">— g · — kcal</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto text-center text-[10px] text-muted-foreground">
                  Tippe zum Öffnen (Demo)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Archive className="h-4 w-4 text-gold" />
          <h2 className="font-display text-lg font-bold">Archiv</h2>
        </div>
        {archive.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine archivierten Pläne.</p>
        ) : (
          <ul className="divide-y divide-border">
            {archive.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-gold">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.date).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <button
                  onClick={() => toast("Download (Demo)")}
                  className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
