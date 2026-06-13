import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Inbox,
  Scale,
  Users,
  CheckCircle2,
  Clock,
  Utensils,
  Dumbbell,
} from "lucide-react";

import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/coach/")({
  head: () => ({ meta: [{ title: "Coach Dashboard — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CoachDashboard />
    </AppLayout>
  ),
});

type Client = {
  id: string;
  display_name: string | null;
  last_checkin: string | null;
  last_weight: number | null;
  last_weight_at: string | null;
  last_nutrition_at: string | null;
  last_nutrition_name: string | null;
  last_training_at: string | null;
};


type Lead = {
  id: string;
  name: string;
  email: string;
  goal: string | null;
  created_at: string;
};

function mondayOf(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function CoachDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const weekStart = mondayOf(new Date());

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Find all client user_ids
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");
      const ids = (rolesData ?? []).map((r) => r.user_id);

      let clientRows: Client[] = [];
      if (ids.length > 0) {
        const [profiles, checkins, measurements] = await Promise.all([
          supabase.from("profiles").select("id, display_name").in("id", ids),
          supabase
            .from("weekly_checkins")
            .select("user_id, week_start, submitted_at")
            .in("user_id", ids)
            .order("week_start", { ascending: false }),
          supabase
            .from("body_measurements")
            .select("user_id, weight_kg, measured_at")
            .in("user_id", ids)
            .order("measured_at", { ascending: false }),
        ]);

        const lastCheckin = new Map<string, string>();
        (checkins.data ?? []).forEach((c) => {
          if (!lastCheckin.has(c.user_id)) lastCheckin.set(c.user_id, c.week_start);
        });
        const lastWeight = new Map<string, { w: number | null; at: string }>();
        (measurements.data ?? []).forEach((m) => {
          if (!lastWeight.has(m.user_id))
            lastWeight.set(m.user_id, { w: m.weight_kg, at: m.measured_at });
        });

        clientRows = (profiles.data ?? []).map((p) => ({
          id: p.id,
          display_name: p.display_name,
          last_checkin: lastCheckin.get(p.id) ?? null,
          last_weight: lastWeight.get(p.id)?.w ?? null,
          last_weight_at: lastWeight.get(p.id)?.at ?? null,
        }));
      }
      setClients(clientRows);

      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, email, goal, created_at")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(10);
      setLeads((leadsData as Lead[]) ?? []);

      setLoading(false);
    })();
  }, []);

  const openWeek = clients.filter((c) => c.last_checkin !== weekStart);
  const inactive = clients
    .map((c) => ({ ...c, days: daysAgo(c.last_checkin) }))
    .filter((c) => c.days === null || c.days >= 14)
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
  const recentMeasurements = [...clients]
    .filter((c) => c.last_weight_at)
    .sort(
      (a, b) =>
        new Date(b.last_weight_at!).getTime() - new Date(a.last_weight_at!).getTime(),
    )
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Woche ab {new Date(weekStart).toLocaleDateString("de-DE")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill icon={<Users className="h-4 w-4" />} value={clients.length} label="Kunden" />
          <StatPill icon={<Inbox className="h-4 w-4" />} value={leads.length} label="Neue Leads" />
          <StatPill
            icon={<Clock className="h-4 w-4" />}
            value={openWeek.length}
            label="Check-in offen"
            warn={openWeek.length > 0}
          />
          <Link
            to="/coach/package-requests"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:border-gold/40"
          >
            <span className="text-gold">📦</span>
            <span className="font-display text-sm font-bold">Paketanfragen</span>
          </Link>
        </div>

      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Lade…
        </div>
      )}

      {!loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Diese Woche offen */}
          <Panel
            icon={<Clock className="h-5 w-5" />}
            title="Diese Woche noch offen"
            empty={openWeek.length === 0}
            emptyText="Alle Kunden haben ihren Wochen-Check-in abgegeben 🎉"
            footer={
              <Link to="/coach/customers" className="text-xs font-semibold text-gold hover:underline">
                Alle Kunden ansehen →
              </Link>
            }
          >
            {openWeek.slice(0, 8).map((c) => (
              <CustomerRow
                key={c.id}
                id={c.id}
                name={c.display_name ?? "Ohne Namen"}
                meta={
                  c.last_checkin
                    ? `Letzter Check-in ${new Date(c.last_checkin).toLocaleDateString("de-DE")}`
                    : "Noch nie eingecheckt"
                }
              />
            ))}
            {openWeek.length > 8 && (
              <div className="px-1 pt-1 text-xs text-muted-foreground">
                +{openWeek.length - 8} weitere
              </div>
            )}
          </Panel>

          {/* Inaktiv-Warnung */}
          <Panel
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Inaktiv (14+ Tage)"
            empty={inactive.length === 0}
            emptyText="Niemand inaktiv. Top!"
          >
            {inactive.slice(0, 8).map((c) => (
              <CustomerRow
                key={c.id}
                id={c.id}
                name={c.display_name ?? "Ohne Namen"}
                warn
                meta={
                  c.days === null
                    ? "Noch nie eingecheckt"
                    : `Vor ${c.days} Tagen zuletzt aktiv`
                }
              />
            ))}
          </Panel>

          {/* Neue Leads */}
          <Panel
            icon={<Inbox className="h-5 w-5" />}
            title="Neue Anfragen"
            empty={leads.length === 0}
            emptyText="Keine neuen Anfragen"
            footer={
              <Link to="/coach/leads" className="text-xs font-semibold text-gold hover:underline">
                Alle Anfragen →
              </Link>
            }
          >
            {leads.slice(0, 6).map((l) => (
              <Link
                key={l.id}
                to="/coach/leads"
                className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 hover:border-gold/40"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
                  {l.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{l.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {l.goal ?? l.email}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(l.created_at).toLocaleDateString("de-DE")}
                </div>
              </Link>
            ))}
          </Panel>

          {/* Aktuelle Maße */}
          <Panel
            icon={<Scale className="h-5 w-5" />}
            title="Letzte Messungen"
            empty={recentMeasurements.length === 0}
            emptyText="Noch keine Messungen erfasst"
          >
            {recentMeasurements.map((c) => (
              <CustomerRow
                key={c.id}
                id={c.id}
                name={c.display_name ?? "Ohne Namen"}
                meta={
                  c.last_weight_at
                    ? `${c.last_weight ?? "—"} kg · ${new Date(
                        c.last_weight_at,
                      ).toLocaleDateString("de-DE")}`
                    : "—"
                }
                tone="info"
              />
            ))}
          </Panel>
        </div>
      )}
    </div>
  );
}

function StatPill({
  icon,
  value,
  label,
  warn,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
        warn ? "border-warning/40 bg-warning/10" : "border-border bg-card"
      }`}
    >
      <span className={warn ? "text-warning" : "text-gold"}>{icon}</span>
      <span className="font-display text-lg font-bold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
  empty,
  emptyText,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  empty: boolean;
  emptyText: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-gold">{icon}</span>
        <h2 className="font-display text-lg font-bold">{title}</h2>
      </div>
      {empty ? (
        <div className="flex items-center gap-2 rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-gold" />
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}

function CustomerRow({
  id,
  name,
  meta,
  warn,
  tone,
}: {
  id: string;
  name: string;
  meta: string;
  warn?: boolean;
  tone?: "info";
}) {
  return (
    <Link
      to="/coach/customers/$userId"
      params={{ userId: id }}
      className={`flex items-center gap-3 rounded-xl border bg-background/40 p-3 transition hover:border-gold/40 ${
        warn ? "border-warning/30" : "border-border"
      }`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div
          className={`truncate text-xs ${
            warn ? "text-warning" : tone === "info" ? "text-gold" : "text-muted-foreground"
          }`}
        >
          {meta}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
