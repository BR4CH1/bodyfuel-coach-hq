import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Users } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { CLIENTS } from "@/lib/bodyfuel/session";
import {
  daysSinceLastCheck,
  getLevel,
  todayPoints,
  totalPoints,
  weekPoints,
} from "@/lib/bodyfuel/data";

export const Route = createFileRoute("/coach/")({
  head: () => ({ meta: [{ title: "Coach Dashboard — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CoachList />
    </AppLayout>
  ),
});

function CoachList() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Kundenübersicht</h1>
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm sm:flex">
          <Users className="h-4 w-4 text-gold" />
          <span className="font-semibold">{CLIENTS.length}</span>
          <span className="text-muted-foreground">aktive Kunden</span>
        </div>
      </div>

      <div className="grid gap-3 lg:hidden">
        {CLIENTS.map((c) => {
          const pts = totalPoints(c);
          const { level } = getLevel(pts);
          const days = daysSinceLastCheck(c);
          const warn = days >= 3;
          return (
            <Link
              key={c.id}
              to="/coach/$clientId"
              params={{ clientId: c.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-gold/40"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-gold font-display text-sm font-bold text-primary-foreground">
                {c.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  {warn && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                </div>
                <div className="text-xs text-gold">
                  {level.name} · {pts} Pkt
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Streak {c.streak} · {days === 0 ? "heute aktiv" : `vor ${days} Tagen`}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
        <table className="w-full">
          <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Kunde</th>
              <th className="px-5 py-3">Level</th>
              <th className="px-5 py-3">Gesamt</th>
              <th className="px-5 py-3">Woche</th>
              <th className="px-5 py-3">Heute</th>
              <th className="px-5 py-3">Streak</th>
              <th className="px-5 py-3">Letzter Check-in</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {CLIENTS.map((c) => {
              const pts = totalPoints(c);
              const { level } = getLevel(pts);
              const days = daysSinceLastCheck(c);
              const warn = days >= 3;
              return (
                <tr
                  key={c.id}
                  className="border-b border-border transition last:border-0 hover:bg-secondary/40"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-gold font-display text-xs font-bold text-primary-foreground">
                        {c.avatar}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold">
                      {level.name}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-display font-bold">{pts}</td>
                  <td className="px-5 py-4">{weekPoints(c)}</td>
                  <td className="px-5 py-4">{todayPoints(c)}</td>
                  <td className="px-5 py-4">
                    <span className={c.streak >= 14 ? "text-gold" : ""}>{c.streak} Tage</span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm ${
                        warn ? "text-warning" : "text-muted-foreground"
                      }`}
                    >
                      {warn && <AlertTriangle className="h-3.5 w-3.5" />}
                      {days === 0 ? "heute" : `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to="/coach/$clientId"
                      params={{ clientId: c.id }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
                    >
                      Details <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {CLIENTS.some((c) => daysSinceLastCheck(c) >= 3) && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="text-sm">
            <div className="font-semibold">Inaktive Kunden</div>
            <div className="text-xs text-muted-foreground">
              {CLIENTS.filter((c) => daysSinceLastCheck(c) >= 3)
                .map((c) => c.name)
                .join(", ")}{" "}
              haben seit 3+ Tagen nichts eingetragen.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
