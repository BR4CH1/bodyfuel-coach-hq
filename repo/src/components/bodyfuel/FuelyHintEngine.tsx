/**
 * FuelyHintEngine — zentraler, clientseitiger Event-/Hint-Generator für Fuely.
 *
 * Pollt alle 5 Min (und bei Route-Wechsel) den aktuellen Zustand des Nutzers
 * und feuert priorisiert genau EINEN Hinweis über `showFuelyHint`.
 * Dedup pro Tag über localStorage, damit Nutzer nicht mit Nachrichten
 * überschüttet werden.
 *
 * Deckt ab: Ernährung (Protein, Kcal, Wasser), Training (offen/erledigt),
 * Check-ins, Streaks, Motivation, Überraschungen.
 */
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";
import { showFuelyHint, setFuelyUnread } from "@/components/bodyfuel/FuelyFAB";

const POLL_MS = 5 * 60 * 1000;
const STREAK_MILESTONES = [3, 7, 14, 30, 100];
const MOTIVATIONS = [
  "Jeder kleine Schritt zählt.",
  "Nicht perfekt sein. Konsequent sein.",
  "Du ziehst das gerade richtig gut durch.",
  "Kleine Gewohnheit, große Wirkung.",
  "Weiter so — du bist auf einem starken Weg.",
];
const SURPRISES = [
  "Ich hab heute eine kleine Überraschung für dich 👀",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function isoWeek() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((+d - +onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
function ls(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: string) {
  try { window.localStorage.setItem(key, val); } catch {}
}

type Hint = { key: string; message: string; href?: string; priority: number };

export function FuelyHintEngine() {
  const { supabaseUser, loading } = useSession();
  const ent = useEntitlements();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ticking = useRef(false);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (loading || !supabaseUser) return;
    const userId = supabaseUser.id;

    const orgSlug = (() => {
      const seg = pathname.split("/").filter(Boolean)[0];
      const known = new Set(["auth","login","dashboard","coach","coach-tools","admin","app","tracker","smart","messages","achievements","ranking","measurements","profile","progress","training","training-import","nutrition","community","checkout","welcome","impressum","datenschutz","trust","unsubscribe","join","guardian-consent","check-in","daily-checklist","mein-bodyfuel","onboarding","strength-check","api"]);
      if (seg && !known.has(seg)) return seg;
      return ent.primaryOrgSlug ?? null;
    })();

    async function run() {
      if (ticking.current) return;
      if (Date.now() - lastRunRef.current < 60_000) return; // min 1 min gap
      ticking.current = true;
      lastRunRef.current = Date.now();
      try {
        const day = todayISO();
        const now = new Date();
        const hour = now.getHours();
        const hints: Hint[] = [];

        // Streak (highest priority, only on milestone reach)
        const { data: pts } = await supabase
          .from("user_points")
          .select("current_streak")
          .eq("user_id", userId)
          .maybeSingle();
        const streak = Number((pts as any)?.current_streak ?? 0);
        if (streak > 0) {
          const lastCelebrated = Number(ls(`fuely:streak:${userId}`) ?? 0);
          const milestone = STREAK_MILESTONES.filter((m) => streak >= m && m > lastCelebrated).pop();
          if (milestone) {
            hints.push({
              key: `streak-${milestone}`,
              message: `🔥 ${milestone}-Tage-Streak! Du ziehst das durch.`,
              priority: 100,
              href: orgSlug ? `/${orgSlug}/home` : undefined,
            });
            lsSet(`fuely:streak:${userId}`, String(milestone));
          }
        }

        // Nutrition targets + today's intake
        const [{ data: targets }, { data: foods }, { data: waters }] = await Promise.all([
          supabase.from("nutrition_targets").select("kcal, protein_g, water_glasses").eq("user_id", userId).maybeSingle(),
          supabase.from("food_entries").select("kcal, protein_g").eq("user_id", userId).eq("entry_date", day),
          supabase.from("water_logs").select("glasses").eq("user_id", userId).eq("entry_date", day).maybeSingle(),
        ]);
        const tKcal = Number((targets as any)?.kcal ?? 0);
        const tProt = Number((targets as any)?.protein_g ?? 0);
        const tWater = Number((targets as any)?.water_glasses ?? 8);
        const eKcal = (foods ?? []).reduce((s: number, r: any) => s + Number(r.kcal ?? 0), 0);
        const eProt = (foods ?? []).reduce((s: number, r: any) => s + Number(r.protein_g ?? 0), 0);
        const glasses = Number((waters as any)?.glasses ?? 0);

        const nutritionHref = orgSlug ? `/${orgSlug}/nutrition` : undefined;

        // Water goal reached
        if (tWater > 0 && glasses >= tWater) {
          hints.push({ key: "water-done", message: "Mega! Wasserziel geschafft 💧", priority: 70, href: nutritionHref });
        } else if (tWater > 0 && glasses >= Math.ceil(tWater / 2) && glasses < tWater) {
          hints.push({ key: "water-half", message: "Halbzeit beim Trinken! Weiter so.", priority: 40, href: nutritionHref });
        }

        // Protein deficit — after 17:00
        if (hour >= 17 && tProt > 0) {
          const gap = tProt - eProt;
          if (gap >= 20) {
            hints.push({
              key: "protein-gap",
              message: `Dir fehlen noch ${Math.round(gap)} g Protein 💪 Ich hab ein paar Ideen.`,
              priority: 80,
              href: nutritionHref,
            });
          }
        }

        // Kcal over/under — after 19:00
        if (hour >= 19 && tKcal > 0) {
          if (eKcal > tKcal * 1.15) {
            hints.push({ key: "kcal-over", message: "Heute bist du etwas drüber. Kein Problem – ich zeig dir, wie wir das ausgleichen.", priority: 60, href: nutritionHref });
          } else if (eKcal > 0 && eKcal < tKcal * 0.7) {
            hints.push({ key: "kcal-under", message: "Heute wird's eng mit deinem Kalorienziel.", priority: 60, href: nutritionHref });
          }
        }

        // Training today
        const { data: sess } = await supabase
          .from("training_sessions")
          .select("status, completed_at, session_date")
          .eq("client_id", userId)
          .eq("session_date", day);
        const trainingHref = orgSlug ? `/${orgSlug}/training` : undefined;
        if (sess && sess.length > 0) {
          const done = sess.some((s: any) => s.status === "completed" || s.completed_at);
          const open = sess.some((s: any) => !(s.status === "completed" || s.completed_at));
          if (done) {
            hints.push({ key: "training-done", message: "Stark! Training erledigt 🔥", priority: 75, href: trainingHref });
          } else if (open && hour >= 11) {
            hints.push({ key: "training-open", message: "Heute steht Training an 👀", priority: 85, href: trainingHref });
          }
        }

        // Check-in reminder after 19:00
        if (hour >= 19) {
          const { data: ci } = await supabase
            .from("athlete_checkins")
            .select("id")
            .eq("user_id", userId)
            .gte("created_at", `${day}T00:00:00`)
            .limit(1);
          if (!ci || ci.length === 0) {
            hints.push({
              key: "checkin-missing",
              message: "Vergiss deinen heutigen Check-in nicht.",
              priority: 82,
              href: orgSlug ? `/${orgSlug}/checkin` : undefined,
            });
          }
        }

        // Motivation — max 2 per ISO week, only when nothing else pending
        const weekKey = `fuely:motiv:${userId}:${isoWeek()}`;
        const motivCount = Number(ls(weekKey) ?? 0);
        if (motivCount < 2 && Math.random() < 0.15) {
          const m = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
          hints.push({ key: `motiv-${weekKey}-${motivCount}`, message: m, priority: 10 });
        }

        // Surprise — ~2%
        if (Math.random() < 0.02) {
          const m = SURPRISES[0];
          hints.push({ key: `surprise-${day}`, message: m, priority: 20, href: orgSlug ? `/${orgSlug}/home` : undefined });
        }

        // Pick highest priority hint not yet shown today
        hints.sort((a, b) => b.priority - a.priority);
        for (const h of hints) {
          const shownKey = `fuely:hint:${userId}:${day}:${h.key}`;
          if (ls(shownKey)) continue;
          lsSet(shownKey, "1");
          if (h.key.startsWith("motiv-")) lsSet(weekKey, String(motivCount + 1));
          showFuelyHint(h.message, { href: h.href });
          setFuelyUnread(1);
          break;
        }
      } catch (err) {
        // Silently swallow — hint engine must never break the app
        console.warn("[FuelyHintEngine]", err);
      } finally {
        ticking.current = false;
      }
    }

    // First run shortly after mount, then interval
    const t0 = window.setTimeout(run, 3000);
    const iv = window.setInterval(run, POLL_MS);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(iv);
    };
  }, [loading, supabaseUser, pathname, ent.primaryOrgSlug]);

  return null;
}

export default FuelyHintEngine;
