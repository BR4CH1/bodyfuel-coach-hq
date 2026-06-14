import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Inbox, AlertTriangle, Clock, Sparkles, Search } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { listCustomers } from "@/lib/coaching.functions";
import { listTrialUsers } from "@/lib/trial.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coach/customers/")({
  head: () => ({ meta: [{ title: "Kunden — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CustomersList />
    </AppLayout>
  ),
});

type Filter = "all" | "due" | "overdue" | "bulls" | "trial" | "trial_expired";

function daysLeft(end: string | null): number | null {
  if (!end) return null;
  return Math.ceil((new Date(`${end}T23:59:59Z`).getTime() - Date.now()) / 86_400_000);
}

function CustomersList() {
  const fn = useServerFn(listCustomers);
  const trialFn = useServerFn(listTrialUsers);
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => fn(),
  });
  const { data: trials } = useQuery({
    queryKey: ["trial-users"],
    queryFn: () => trialFn(),
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const trialCount = (trials ?? []).filter((t: any) => t.trial_status === "trial").length;
  const trialExpiredCount = (trials ?? []).filter((t: any) => t.trial_status === "trial_expired").length;

  const counts = useMemo(() => {
    const due = (data ?? []).filter((c: any) => c.payment_status === "due").length;
    const overdue = (data ?? []).filter((c: any) => c.payment_status === "overdue").length;
    const bulls = (data ?? []).filter((c: any) => (c.groups ?? []).includes("bulls")).length;
    return { all: data?.length ?? 0, due, overdue, bulls, trial: trialCount, trial_expired: trialExpiredCount };
  }, [data, trialCount, trialExpiredCount]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data as any[];
    if (filter !== "all") {
      if (filter === "bulls") list = list.filter((c) => (c.groups ?? []).includes("bulls"));
      else list = list.filter((c) => c.payment_status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.display_name ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, filter, search]);


  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Kunden & Pakete</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/coach/leads">
            <Button variant="outline" size="sm">
              <Inbox className="mr-1 h-4 w-4" /> Anfragen
            </Button>
          </Link>
          <Link to="/coach/customers/new">
            <Button size="sm" className="bg-gradient-gold text-primary-foreground">
              <Plus className="mr-1 h-4 w-4" /> Neuer Kunde
            </Button>
          </Link>
        </div>
      </div>

      {/* Warn-Banner */}
      {(counts.overdue > 0 || counts.due > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {counts.overdue > 0 && (
            <button
              onClick={() => setFilter("overdue")}
              className="flex items-center justify-between rounded-2xl border border-destructive/60 bg-destructive/10 p-4 text-left hover:bg-destructive/15"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-destructive">Überfällig</div>
                  <div className="font-display text-lg font-bold">
                    {counts.overdue} Kunde{counts.overdue === 1 ? "" : "n"}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-destructive" />
            </button>
          )}
          {counts.due > 0 && (
            <button
              onClick={() => setFilter("due")}
              className="flex items-center justify-between rounded-2xl border border-gold/50 bg-gold/10 p-4 text-left hover:bg-gold/15"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gold" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-gold">Zahlung fällig</div>
                  <div className="font-display text-lg font-bold">
                    {counts.due} Kunde{counts.due === 1 ? "" : "n"}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gold" />
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kunden suchen…"
          className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        />
      </div>

      {/* Filter-Chips */}
      <div className="flex flex-wrap gap-2">
        {([
          ["all", `Alle (${counts.all})`],
          ["due", `Zahlung fällig (${counts.due})`],
          ["overdue", `Überfällig (${counts.overdue})`],
          ["bulls", `Bulls (${counts.bulls})`],
          ["trial", `Trial (${counts.trial})`],
          ["trial_expired", `Trial abgelaufen (${counts.trial_expired})`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition " +
              (filter === key
                ? key === "overdue" || key === "trial_expired"
                  ? "border-destructive bg-destructive/15 text-destructive"
                  : "border-gold bg-gold/15 text-gold"
                : "border-border text-muted-foreground hover:border-gold/40")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {(filter === "trial" || filter === "trial_expired") && (
        <TrialList
          users={(trials ?? []).filter((t: any) => t.trial_status === filter)}
        />
      )}

      {filter !== "trial" && filter !== "trial_expired" && isLoading && (
        <p className="text-sm text-muted-foreground">Lade…</p>
      )}
      {filter !== "trial" && filter !== "trial_expired" && data && filtered.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {filter === "all"
            ? "Noch keine Kunden angelegt."
            : "Keine Kunden in dieser Ansicht."}
        </p>
      )}


      {filter !== "trial" && filter !== "trial_expired" && filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Paket</th>
                  <th className="px-4 py-3">Preis</th>
                  <th className="px-4 py-3">Ende</th>
                  <th className="px-4 py-3">Letzte Zahlung</th>
                  <th className="px-4 py-3">Zahlung</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(filtered as any[]).map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{c.display_name ?? "—"}</span>
                        {(c.groups ?? []).includes("bulls") && <BullsBadge />}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 uppercase tracking-wider text-gold">{c.package}</td>
                    <td className="px-4 py-3 font-display">{Number(c.price_eur).toFixed(2)} €</td>
                    <td className="px-4 py-3">
                      {c.end_date}
                      {c.is_active && c.days_until_end <= 7 && c.days_until_end >= 0 && (
                        <div className="text-[10px] uppercase tracking-wider text-gold">
                          läuft in {c.days_until_end} T.
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.last_payment_date ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentBadge c={c} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/coach/customers/$userId"
                        params={{ userId: c.user_id }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
                      >
                        Detail <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {(filtered as any[]).map((c) => (
              <Link
                key={c.id}
                to="/coach/customers/$userId"
                params={{ userId: c.user_id }}
                className="block rounded-2xl border border-border bg-card p-4 active:bg-secondary/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{c.display_name ?? "—"}</p>
                      {(c.groups ?? []).includes("bulls") && <BullsBadge />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.email ?? "—"}</p>
                  </div>
                  <PaymentBadge c={c} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Paket</p>
                    <p className="uppercase tracking-wider text-gold">{c.package}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Preis</p>
                    <p className="font-display">{Number(c.price_eur).toFixed(2)} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ende</p>
                    <p>{c.end_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Letzte Zahlung</p>
                    <p>{c.last_payment_date ?? "—"}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-gold">
                  Detail <ChevronRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PaymentBadge({ c }: { c: any }) {
  if (c.payment_status === "overdue") {
    const label =
      c.payment_days_left != null
        ? `Überfällig (${Math.abs(c.payment_days_left)} T.)`
        : "Überfällig";
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/60 bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase text-destructive">
        <AlertTriangle className="h-3 w-3" /> {label}
        {c.pending_amount > 0 && (
          <span className="ml-1 font-display">{Number(c.pending_amount).toFixed(2)} €</span>
        )}
      </span>
    );
  }
  if (c.payment_status === "due") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2 py-1 text-[10px] font-bold uppercase text-gold">
        <Clock className="h-3 w-3" /> Fällig in {c.payment_days_left} T.
        {c.pending_amount > 0 && (
          <span className="ml-1 font-display">{Number(c.pending_amount).toFixed(2)} €</span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-500">
      OK
    </span>
  );
}

function BullsBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-full border border-red-500/60 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500">
      Bulls
    </span>
  );
}

function TrialList({ users }: { users: any[] }) {
  if (users.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Keine Nutzer in dieser Ansicht.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {users.map((u) => {
        const dl = u.trial_end
          ? Math.ceil(
              (new Date(`${u.trial_end}T23:59:59Z`).getTime() - Date.now()) / 86_400_000,
            )
          : null;
        const expired = u.trial_status === "trial_expired";
        return (
          <Link
            key={u.id}
            to="/coach/customers/$userId"
            params={{ userId: u.id }}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-gold/40"
          >
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <span className="font-semibold">{u.display_name ?? "—"}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Trial-Ende: {u.trial_end ? new Date(u.trial_end).toLocaleDateString("de-DE") : "—"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={
                  "rounded-full px-2 py-1 text-[10px] font-bold uppercase " +
                  (expired
                    ? "bg-destructive/15 text-destructive"
                    : "bg-gold/15 text-gold")
                }
              >
                {expired
                  ? "Abgelaufen"
                  : `${Math.max(0, dl ?? 0)} ${dl === 1 ? "Tag" : "Tage"} verbleibend`}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

