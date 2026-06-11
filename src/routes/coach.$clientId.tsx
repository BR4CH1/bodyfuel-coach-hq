import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Flame, Mail } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  ACHIEVEMENTS,
  findClient,
  getLevel,
  lastNDays,
  MAX_DAILY_POINTS,
  pointsForDay,
  todayPoints,
  totalPoints,
  weekPoints,
} from "@/lib/bodyfuel/data";

export const Route = createFileRoute("/coach/$clientId")({
  head: ({ params }) => ({
    meta: [{ title: `${findClient(params.clientId)?.name ?? "Kunde"} — Coach` }],
  }),
  loader: ({ params }) => {
    const client = findClient(params.clientId);
    if (!client) throw notFound();
    return { client };
  },
  component: () => (
    <AppLayout>
      <ClientDetail />
    </AppLayout>
  ),
  notFoundComponent: () => (
    <AppLayout>
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Kunde nicht gefunden.</p>
        <Link to="/coach" className="mt-4 inline-block text-gold hover:underline">
          Zurück zur Übersicht
        </Link>
      </div>
    </AppLayout>
  ),
});


function ClientDetail() {
  const { clientId } = Route.useParams();
  const client = findClient(clientId)!;
  const pts = totalPoints(client);
  const { level, next, progress } = getLevel(pts);

  const days = lastNDays(14)
    .reverse()
    .map((d) => ({
      date: new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
      Punkte: pointsForDay(client.checks.find((c) => c.date === d)),
    }));

  const earnedAchievements = ACHIEVEMENTS.map((a) => ({ a, r: a.check(client) }));

  return (
    <div className="space-y-6">
      <Link
        to="/coach"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Alle Kunden
      </Link>

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-gold font-display text-xl font-bold text-primary-foreground shadow-gold">
              {client.avatar}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold">{client.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {client.email}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold">
                  {level.name}
                </span>
                <span className="text-sm text-muted-foreground">{pts} Gesamtpunkte</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-1">
            <Stat label="Heute" value={`${todayPoints(client)}/${MAX_DAILY_POINTS}`} />
            <Stat label="Woche" value={weekPoints(client)} />
            <Stat label="Streak" value={`${client.streak} 🔥`} />
          </div>
        </div>

        {next && (
          <div className="relative mt-6">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{level.name}</span>
              <span className="text-muted-foreground">
                {next.min - pts} bis {next.name}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-gold"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold">Punkte – letzte 14 Tage</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, MAX_DAILY_POINTS]} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="Punkte"
                stroke="var(--gold)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--gold)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Achievements + Plan */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold">Erfolge</h2>
          <ul className="space-y-3">
            {earnedAchievements.map(({ a, r }) => {
              const pct = Math.round((r.progress / r.total) * 100);
              return (
                <li key={a.id} className="flex items-center gap-3">
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg ${
                      r.done ? "bg-gradient-gold" : "bg-secondary"
                    }`}
                  >
                    {a.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{a.name}</span>
                      <span className="text-muted-foreground">
                        {r.progress}/{r.total}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${
                          r.done ? "bg-gradient-gold" : "bg-muted-foreground/50"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold">Aktueller Ernährungsplan</h2>
          {client.plans
            .filter((p) => p.current)
            .map((p) => (
              <div key={p.id} className="rounded-xl border border-gold/40 bg-accent/30 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold">
                  <Flame className="h-3.5 w-3.5" /> Aktiv
                </div>
                <div className="mt-1 font-display text-lg font-bold">{p.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  seit {new Date(p.date).toLocaleDateString("de-DE")}
                </div>
              </div>
            ))}
          <div className="mt-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Archiv
            </div>
            <ul className="space-y-1.5">
              {client.plans
                .filter((p) => !p.current)
                .map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.date).toLocaleDateString("de-DE")}
                    </span>
                  </li>
                ))}
              {client.plans.filter((p) => !p.current).length === 0 && (
                <li className="text-sm text-muted-foreground">Keine archivierten Pläne.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-4 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}
