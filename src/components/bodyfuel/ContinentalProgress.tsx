import { useState } from "react";
import { Check, Minus, RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASKS } from "@/lib/bodyfuel/data";
import { summarizeChallengeChecks, CHALLENGE_FIRST_DAY, CHALLENGE_END_EXCLUSIVE, type ChallengeCheck } from "@/lib/continental-progress.logic";

type Participant = { id: string; first_name: string; last_name: string; status: string; smart_user_id: string | null; challenge_checks?: ChallengeCheck[] };

export function ContinentalProgress({ participants, loading, error, refresh }: { participants: Participant[]; loading: boolean; error: string | null; refresh: () => void }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [date, setDate] = useState(today < CHALLENGE_FIRST_DAY ? CHALLENGE_FIRST_DAY : today >= CHALLENGE_END_EXCLUSIVE ? "2026-12-14" : today);
  const rows = participants.filter(p => p.status === "approved").map(p => ({ ...p, ...summarizeChallengeChecks(p.challenge_checks ?? [], date) })).sort((a, b) => b.challenge_points - a.challenge_points || a.last_name.localeCompare(b.last_name));
  return <section className="space-y-4" aria-label="Challenge-Tagesziele">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="font-display text-2xl font-bold">Tagesziele & Challenge-Punkte</h2><p className="mt-1 text-sm text-muted-foreground">15.11.–14.12.2026 · Nur Tagesziele im Challenge-Zeitraum, ohne Boni und separate Trainingspunkte.</p></div>
      <div className="flex items-end gap-2"><div><label className="text-xs text-muted-foreground" htmlFor="challenge-check-date">Tagesziele vom</label><Input id="challenge-check-date" type="date" value={date} min={CHALLENGE_FIRST_DAY} max="2026-12-14" onChange={e => { if (e.target.value >= CHALLENGE_FIRST_DAY && e.target.value < CHALLENGE_END_EXCLUSIVE) setDate(e.target.value); }} /></div><Button variant="outline" size="icon" aria-label="Challenge-Punkte aktualisieren" title="Aktualisieren" onClick={refresh}><RefreshCw className="h-4 w-4" /></Button></div>
    </div>
    {loading && <p className="text-sm text-muted-foreground">Lade Tagesziele…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!loading && !error && rows.length === 0 && <p className="text-sm text-muted-foreground">Noch keine freigegebenen Teilnehmer.</p>}
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((row, index) => <article key={row.id} className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-gold" /><span className="text-xs text-muted-foreground">#{index + 1}</span><h3 className="font-semibold">{row.first_name} {row.last_name}</h3></div><p className="mt-1 text-xs text-muted-foreground">{row.smart_user_id ? `${row.perfect_days} perfekte Tage` : "Zugang noch nicht eingerichtet"}</p></div><div className="text-right"><div className="font-display text-xl font-bold text-gold">{row.challenge_points} <span className="text-xs text-muted-foreground">Challenge-Pkt</span></div><div className="text-xs text-muted-foreground">Ausgewählter Tag: {row.day_points} / 15</div></div></div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{TASKS.map(task => <li key={task.key} className="flex items-center gap-2 text-xs"><span className={row.tasks[task.key] ? "text-gold" : "text-muted-foreground"}>{row.tasks[task.key] ? <Check className="h-4 w-4" aria-label="Erledigt" /> : <Minus className="h-4 w-4" aria-label="Offen" />}</span><span className="flex-1">{task.label}</span><span className="text-muted-foreground">{task.points} Pkt</span></li>)}</ul>
      </article>)}
    </div>
  </section>;
}