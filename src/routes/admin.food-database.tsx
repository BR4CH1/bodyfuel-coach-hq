import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFoodDatabaseStats, reconcileFoodCatalogue } from "@/lib/food-database.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Database, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/food-database")({
  head: () => ({ meta: [
    { title: "BodyFuel Lebensmittel – Quellenprüfung und Verwaltung" },
    { name: "description", content: "BodyFuel Lebensmittelkatalog: geprüfte Nährwertquellen, Freigaben und offene Quellenprüfungen." },
    { property: "og:title", content: "BodyFuel Lebensmittel – Quellenprüfung und Verwaltung" },
    { property: "og:description", content: "Quellenbasierte Verwaltung des BodyFuel Lebensmittelkatalogs." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FoodDatabaseAdminPage,
});

function FoodDatabaseAdminPage() {
  const load = useServerFn(getFoodDatabaseStats);
  const reconcile = useServerFn(reconcileFoodCatalogue);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getFoodDatabaseStats>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      setStats(await load({} as any));
    } catch (e: any) {
      setErr(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <Link
          to="/coach"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Coach
        </Link>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Lebensmittel-Datenbank</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Ein zentraler, auditierter Katalog für Suche, Tracker und Ernährungspläne. Importe (USDA,
          Open Food Facts, BLS) laufen über das <code>bodyfuel_food_database/</code> ImportKit und
          schreiben in <code>nutrition_foods</code>.
        </p>
      </div>

      {err && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {err}
        </div>
      )}

      <section className="space-y-3 border-y border-border py-4" aria-label="Nährwert-Quellenabgleich">
        <h2 className="font-semibold">Nährwert-Quellenabgleich · 20.11.2026</h2>
        <Button variant="outline" disabled={auditing || loading || !!err} onClick={async () => {
          setAuditing(true);
          setErr(null);
          try {
            const result = await reconcile();
            setAuditResult(`${result.reviewed} geprüft · ${result.corrected} mit BLS/USDA abgeglichen · ${result.needsSource} benötigen Originalquelle oder Etikett`);
            await refresh();
          } catch (error) {
            setErr(error instanceof Error ? error.message : "Quellenabgleich fehlgeschlagen");
          } finally { setAuditing(false); }
        }}>
          <RefreshCw className={`mr-2 h-4 w-4 ${auditing ? "animate-spin" : ""}`} />
          {auditing ? "Quellenabgleich läuft…" : "Quellenabgleich anwenden"}
        </Button>
        {auditResult && <p role="status" className="text-sm text-muted-foreground">{auditResult}</p>}
      </section>

      {stats && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Stat label="Gesamt zentral" value={stats.totalFoods.toLocaleString("de-DE")} />
            <Stat label="Freigegeben" value={stats.safeFoods.toLocaleString("de-DE")} />
            <Stat label="Prüfung nötig" value={stats.reviewFoods.toLocaleString("de-DE")} />
            <Stat label="Flüssigkeiten (ml)" value={stats.liquidFoods.toLocaleString("de-DE")} />
            <Stat
              label="Private Nutzer-Lebensmittel"
              value={stats.userFoods.toLocaleString("de-DE")}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Nach Quelle</h2>
            {Object.keys(stats.bySource).length === 0 ? (
              <div className="text-sm text-muted-foreground">Noch keine Daten importiert.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, n]) => (
                    <Badge key={src} variant="secondary" className="text-xs">
                      {src}: {n.toLocaleString("de-DE")}
                    </Badge>
                  ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2 text-sm font-semibold">
              Letzte Importe
            </div>
            {stats.recentRuns.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                Noch keine Importläufe protokolliert. Starte einen Import mit den Python-Skripten:
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                  python scripts/import_usda.py python scripts/import_openfoodfacts.py python
                  scripts/import_bls.py
                </pre>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentRuns.map((r: any) => (
                  <div key={r.id} className="grid grid-cols-6 gap-2 px-4 py-2 text-xs">
                    <div className="font-medium">{r.source}</div>
                    <div>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="tabular-nums">gelesen: {r.rows_read ?? 0}</div>
                    <div className="tabular-nums">importiert: {r.rows_imported ?? 0}</div>
                    <div className="tabular-nums">verworfen: {r.rows_rejected ?? 0}</div>
                    <div className="text-muted-foreground">
                      {new Date(r.started_at).toLocaleString("de-DE")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "success" ? "secondary" : status === "running" ? "outline" : "destructive";
  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
  );
}
