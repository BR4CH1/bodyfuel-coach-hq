import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trophy, Flame, TrendingUp, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { FreeAppLayout } from "@/components/bodyfuel/FreeAppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { getRanking, getMyNickname, setMyNickname, type RankingEntry } from "@/lib/ranking.functions";
import { getLevel } from "@/lib/bodyfuel/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/ranking")({
  head: () => ({ meta: [{ title: "Ranking — BODYFUEL" }] }),
  component: RankingRoute,
});

function RankingRoute() {
  const { isFreeUser } = useSession();
  const Layout = isFreeUser ? FreeAppLayout : AppLayout;
  return (
    <Layout>
      <RankingPage />
    </Layout>
  );
}

type SortKey = "total" | "weekly" | "streak" | "level";

const SORTS: { key: SortKey; label: string; icon: any }[] = [
  { key: "total", label: "Gesamtpunkte", icon: Trophy },
  { key: "weekly", label: "Diese Woche", icon: TrendingUp },
  { key: "streak", label: "Streak", icon: Flame },
  { key: "level", label: "Level", icon: Star },
];

function RankingPage() {
  const { supabaseUser } = useSession();
  const qc = useQueryClient();
  const rankingFn = useServerFn(getRanking);
  const nickFn = useServerFn(getMyNickname);
  const setNickFn = useServerFn(setMyNickname);

  const { data: myNick, isLoading: nickLoading } = useQuery({
    queryKey: ["my-nickname"],
    queryFn: () => nickFn(),
  });

  const needsNickname = !nickLoading && !myNick?.nickname;

  const { data, isLoading } = useQuery({
    queryKey: ["ranking"],
    queryFn: () => rankingFn(),
    enabled: !needsNickname,
  });

  const [sort, setSort] = useState<SortKey>("total");
  const [nickInput, setNickInput] = useState("");

  const saveMut = useMutation({
    mutationFn: (nickname: string) => setNickFn({ data: { nickname } }),
    onSuccess: () => {
      toast.success("Nickname gespeichert");
      qc.invalidateQueries({ queryKey: ["my-nickname"] });
      qc.invalidateQueries({ queryKey: ["ranking"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sorted = [...(data ?? [])]
    .filter((e) => e.nickname) // only entries with nickname
    .sort((a, b) => {
      switch (sort) {
        case "weekly": return b.weekly_points - a.weekly_points;
        case "streak": return b.current_streak - a.current_streak;
        case "level": return b.total_points - a.total_points;
        default: return b.total_points - a.total_points;
      }
    });

  const myIdx = sorted.findIndex((e) => e.user_id === supabaseUser?.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Community</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Ranking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vergleiche dich anonym mit anderen Coaching-Mitgliedern. Du erscheinst nur mit deinem Nickname.
        </p>
      </div>

      <Dialog open={needsNickname} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Wähle deinen Nickname</DialogTitle>
            <DialogDescription>
              Damit du im Ranking erscheinst, brauchen wir einen Spitznamen. Dein echter Name bleibt privat.
              <br />2–20 Zeichen, nur Buchstaben, Zahlen, _ oder -.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="nick">Nickname</Label>
            <Input
              id="nick"
              value={nickInput}
              onChange={(e) => setNickInput(e.target.value)}
              placeholder="z.B. IronAndi"
              maxLength={20}
              autoFocus
            />
            <Button
              className="w-full"
              disabled={saveMut.isPending || nickInput.trim().length < 2}
              onClick={() => saveMut.mutate(nickInput.trim())}
            >
              {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Speichern & Ranking ansehen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!needsNickname && (
        <>
          <div className="flex flex-wrap gap-2">
            {SORTS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  sort === key
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {myIdx >= 0 && (
            <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4 text-sm">
              Deine Position: <span className="font-display text-lg text-gold">#{myIdx + 1}</span> von {sorted.length}
              <span className="ml-2 text-muted-foreground">(als {myNick?.nickname})</span>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lade Ranking…</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 w-12">#</th>
                    <th className="px-3 py-2.5">Nickname</th>
                    <th className="px-3 py-2.5 text-right">Punkte</th>
                    <th className="px-3 py-2.5 text-right hidden sm:table-cell">Woche</th>
                    <th className="px-3 py-2.5 text-right hidden sm:table-cell">Streak</th>
                    <th className="px-3 py-2.5 text-right">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e, i) => {
                    const isMe = e.user_id === supabaseUser?.id;
                    return (
                      <tr
                        key={e.user_id}
                        className={`border-b border-border last:border-0 ${
                          isMe ? "bg-gold/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5 font-display font-bold">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </td>
                        <td className="px-3 py-2.5 font-semibold">
                          {e.nickname}
                          {isMe && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold">Du</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-display">{e.total_points}</td>
                        <td className="px-3 py-2.5 text-right hidden sm:table-cell">{e.weekly_points}</td>
                        <td className="px-3 py-2.5 text-right hidden sm:table-cell">{e.current_streak}🔥</td>
                        <td className="px-3 py-2.5 text-right">{e.level}</td>
                      </tr>
                    );
                  })}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        Noch keine Teilnehmer mit Nickname.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </>
      )}
    </div>
  );
}
