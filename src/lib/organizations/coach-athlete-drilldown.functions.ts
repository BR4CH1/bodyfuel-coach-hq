import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyAthlete, STATUS_LABEL, type AthleteStatus } from "./coach-analytics.rules";

/**
 * Analytische Coach-Sicht auf einen einzelnen Athleten.
 * Keine BodyFuel-Privatdaten (Ernährungspläne, private Coaching-Kommunikation),
 * ausschließlich teamrelevante Analytics.
 */

export type CoachAthleteDetail = {
  org: { id: string; name: string; slug: string };
  athlete: {
    user_id: string;
    display_name: string;
    position: string | null;
    secondary_position: string | null;
    jersey_number: number | null;
    team_id: string | null;
    team_name: string | null;
    age: number | null;
    height_cm: number | null;
    current_weight_kg: number | null;
    weight_measured_at: string | null;
  };
  status: {
    key: AthleteStatus;
    label: string;
  };
  radar_triggers: Array<{ kind: string; label: string; detail: string }>;
  summary: {
    lines: string[];
    data_sparse: boolean;
  };
  pulse: {
    compliance: number | null;
    compliance_prev: number | null;
    compliance_delta: number | null;
    training_activity: number | null;
    training_activity_prev: number | null;
    training_activity_delta: number | null;
    strength_score: number | null;
    strength_score_delta: number | null;
    strength_score_span_weeks: number | null;
    last_active_days: number | null;
  };
  compliance: {
    current_week: number | null;
    prev_week: number | null;
    four_week_avg: number | null;
    team_avg: number | null;
    diff_to_team: number | null;
  };
  training: {
    window_days: number;
    assigned: number;
    done: number;
    open: number;
    missed: number;
    completion_rate: number | null;
    timeline: Array<{
      id: string;
      date: string;
      title: string;
      task_type: string;
      status: "done" | "open" | "missed" | "other";
      link_target: string | null;
    }>;
  };
  weight_series: Array<{ measured_at: string; weight_kg: number }>;
  weight_trend_kg_30d: number | null;
  strength: null | {
    overall: number | null;
    overall_delta: number | null;
    last_test_at: string | null;
    categories: Array<{
      key: "lower" | "push" | "pull" | "core";
      label: string;
      score: number | null;
      delta: number | null;
      confidence: number | null;
    }>;
    biggest_gain: { label: string; delta: number } | null;
    biggest_loss: { label: string; delta: number } | null;
  };
  open_items: Array<{ label: string; count: number; kind: string }>;
};

const CATEGORY_LABELS: Record<"lower" | "push" | "pull" | "core", string> = {
  lower: "Lower Body",
  push: "Upper Push",
  pull: "Upper Pull",
  core: "Core",
};

export const getCoachAthleteDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; userId: string }) => ({
    orgId: String(d.orgId),
    userId: String(d.userId),
  }))
  .handler(async ({ data, context }): Promise<CoachAthleteDetail | null> => {
    const { supabase, userId } = context;

    // ---- Authorisierung (identisch zu Cockpit): coach role oder Staff der Org.
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) {
      const { data: staff } = await supabase
        .from("staff_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", data.orgId)
        .maybeSingle();
      if (!staff) throw new Error("Kein Zugriff.");
    }

    // ---- Athlete muss in der Org existieren
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("user_id, role, status, onboarding_completed")
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!membership) return null;

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", data.orgId)
      .maybeSingle();
    if (!org) return null;

    // ---- Zeitfenster
    const now = new Date();
    const start7 = new Date(now); start7.setDate(start7.getDate() - 7); start7.setHours(0, 0, 0, 0);
    const prevStart = new Date(start7); prevStart.setDate(prevStart.getDate() - 7);
    const start30 = new Date(now); start30.setDate(start30.getDate() - 30); start30.setHours(0, 0, 0, 0);
    const start90 = new Date(now); start90.setDate(start90.getDate() - 90); start90.setHours(0, 0, 0, 0);

    // ---- Kern-Queries parallel
    const [
      profileRes,
      teamsRes,
      tasksWindowRes,
      teamTasksWeekRes,
      activityRes,
      sessionCompRes,
      weightsRes,
      strengthRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, height_cm, birthdate")
        .eq("id", data.userId)
        .maybeSingle(),
      supabase
        .from("organization_teams")
        .select("id, name")
        .eq("organization_id", data.orgId),
      supabase
        .from("organization_tasks")
        .select("id, user_id, status, scheduled_for, task_type, title, link_target")
        .eq("organization_id", data.orgId)
        .eq("user_id", data.userId)
        .gte("scheduled_for", start30.toISOString())
        .lt("scheduled_for", now.toISOString())
        .order("scheduled_for", { ascending: false }),
      // Team-Compliance-Vergleich: Aggregat aller Athleten der Org, aktuelle Woche
      supabase
        .from("organization_tasks")
        .select("user_id, status")
        .eq("organization_id", data.orgId)
        .gte("scheduled_for", start7.toISOString())
        .lt("scheduled_for", now.toISOString()),
      supabase
        .from("organization_activity_log")
        .select("created_at")
        .eq("organization_id", data.orgId)
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("organization_athletic_session_completions")
        .select("completed_at")
        .eq("organization_id", data.orgId)
        .eq("user_id", data.userId)
        .order("completed_at", { ascending: false })
        .limit(1),
      supabase
        .from("body_measurements")
        .select("weight_kg, measured_at")
        .eq("user_id", data.userId)
        .not("weight_kg", "is", null)
        .gte("measured_at", start90.toISOString())
        .order("measured_at", { ascending: true }),
      supabase
        .from("strength_checks")
        .select(
          "id, performed_at, completed_at, status, score_total, score_lower, score_push, score_pull, score_core, category_confidence"
        )
        .eq("user_id", data.userId)
        .eq("status", "completed")
        .order("performed_at", { ascending: false })
        .limit(6),
    ]);

    // ---- Team-Zugehörigkeit
    const teamIds = (teamsRes.data ?? []).map((t: any) => t.id);
    let teamMembership: any = null;
    if (teamIds.length) {
      const { data: tm } = await supabase
        .from("team_memberships")
        .select("team_id, position, secondary_position, jersey_number")
        .in("team_id", teamIds)
        .eq("user_id", data.userId)
        .maybeSingle();
      teamMembership = tm ?? null;
    }
    const teamNameById = new Map((teamsRes.data ?? []).map((t: any) => [t.id, t.name]));

    const profile = profileRes.data as any;
    const displayName = profile?.display_name ?? "Athlet";
    const heightCm = profile?.height_cm ?? null;
    let age: number | null = null;
    if (profile?.birthdate) {
      const bd = new Date(profile.birthdate);
      if (!Number.isNaN(bd.getTime())) {
        const diffMs = now.getTime() - bd.getTime();
        age = Math.floor(diffMs / (365.25 * 24 * 3600 * 1000));
      }
    }

    const weights = (weightsRes.data ?? []) as Array<{ weight_kg: number; measured_at: string }>;
    const lastWeight = weights.length ? weights[weights.length - 1] : null;
    // 30-Tage Delta: erster Wert innerhalb 30d vs. letzter
    const weights30d = weights.filter((w) => new Date(w.measured_at) >= start30);
    let weightTrend30d: number | null = null;
    if (weights30d.length >= 2) {
      weightTrend30d =
        Math.round((weights30d[weights30d.length - 1].weight_kg - weights30d[0].weight_kg) * 10) / 10;
    }

    // ---- Tasks-Fenster verarbeiten (30 Tage)
    const tasks = (tasksWindowRes.data ?? []) as Array<{
      id: string;
      status: string;
      scheduled_for: string;
      task_type: string;
      title: string;
      link_target: string | null;
    }>;
    const inRange = (from: Date, to: Date) =>
      tasks.filter((t) => {
        const ts = new Date(t.scheduled_for);
        return ts >= from && ts < to;
      });
    const bucket = (list: typeof tasks) => {
      let total = 0, done = 0, missed = 0, open = 0;
      for (const t of list) {
        total++;
        if (t.status === "done") done++;
        else if (t.status === "missed" || t.status === "skipped") missed++;
        else open++;
      }
      return { total, done, missed, open };
    };
    const week = bucket(inRange(start7, now));
    const prevWeek = bucket(inRange(prevStart, start7));
    const month = bucket(tasks);
    const pct = (b: { total: number; done: number }) =>
      b.total > 0 ? Math.round((b.done / b.total) * 100) : null;

    // 4-Wochen-Durchschnitt: rollende 4 Wochenblöcke à 7 Tagen
    const fourWeekBuckets = [0, 1, 2, 3].map((i) => {
      const to = new Date(now); to.setDate(to.getDate() - i * 7);
      const from = new Date(to); from.setDate(from.getDate() - 7);
      return pct(bucket(inRange(from, to)));
    });
    const validWeeks = fourWeekBuckets.filter((v): v is number => v != null);
    const fourWeekAvg =
      validWeeks.length > 0
        ? Math.round(validWeeks.reduce((a, b) => a + b, 0) / validWeeks.length)
        : null;

    // Trainingsaktivität: Anteil abgeschlossener athletic_/team_training-Tasks im 7d Fenster
    const trainingActivity = (list: typeof tasks) => {
      const training = list.filter((t) =>
        ["athletic_training", "team_training"].includes(t.task_type)
      );
      if (training.length === 0) return null;
      const done = training.filter((t) => t.status === "done").length;
      return Math.round((done / training.length) * 100);
    };
    const trainingCur = trainingActivity(inRange(start7, now));
    const trainingPrev = trainingActivity(inRange(prevStart, start7));

    // Team-Durchschnitt (aktuelle Woche)
    const teamTasksWeek = (teamTasksWeekRes.data ?? []) as Array<{ status: string }>;
    const teamAvg =
      teamTasksWeek.length > 0
        ? Math.round(
            (teamTasksWeek.filter((t) => t.status === "done").length / teamTasksWeek.length) * 100
          )
        : null;

    // Aktivität / days_inactive
    const lastActivityTs = activityRes.data?.[0]?.created_at
      ? new Date(activityRes.data[0].created_at).getTime()
      : null;
    const lastSessionTs = sessionCompRes.data?.[0]?.completed_at
      ? new Date(sessionCompRes.data[0].completed_at).getTime()
      : null;
    const lastActivityMs = [lastActivityTs, lastSessionTs]
      .filter((x): x is number => x != null)
      .reduce<number | null>((max, cur) => (max == null || cur > max ? cur : max), null);
    const daysInactive =
      lastActivityMs != null
        ? Math.floor((now.getTime() - lastActivityMs) / 86_400_000)
        : null;

    // ---- Strength Score V2 (Source-of-Truth = strength_checks)
    const strengthChecks = (strengthRes.data ?? []) as Array<any>;
    const latestStrength = strengthChecks[0] ?? null;
    const prevStrength = strengthChecks[1] ?? null;
    let strengthPayload: CoachAthleteDetail["strength"] = null;
    let strengthScore: number | null = null;
    let strengthDelta: number | null = null;
    let strengthSpanWeeks: number | null = null;
    if (latestStrength) {
      const conf = (latestStrength.category_confidence ?? {}) as Record<string, number>;
      const cat = (key: "lower" | "push" | "pull" | "core") => {
        const scoreKey = `score_${key}` as const;
        const cur: number | null = latestStrength[scoreKey] ?? null;
        const prev: number | null = prevStrength?.[scoreKey] ?? null;
        const delta = cur != null && prev != null ? cur - prev : null;
        return {
          key,
          label: CATEGORY_LABELS[key],
          score: cur,
          delta,
          confidence: conf[key] ?? null,
        };
      };
      const cats = (["lower", "push", "pull", "core"] as const).map(cat);
      const withDelta = cats.filter((c): c is typeof c & { delta: number } => c.delta != null);
      const biggestGain = withDelta.slice().sort((a, b) => b.delta - a.delta)[0] ?? null;
      const biggestLoss = withDelta.slice().sort((a, b) => a.delta - b.delta)[0] ?? null;
      strengthScore = latestStrength.score_total ?? null;
      strengthDelta =
        latestStrength.score_total != null && prevStrength?.score_total != null
          ? latestStrength.score_total - prevStrength.score_total
          : null;
      if (prevStrength?.performed_at && latestStrength.performed_at) {
        const spanMs =
          new Date(latestStrength.performed_at).getTime() -
          new Date(prevStrength.performed_at).getTime();
        strengthSpanWeeks = Math.max(1, Math.round(spanMs / (7 * 86_400_000)));
      }
      strengthPayload = {
        overall: strengthScore,
        overall_delta: strengthDelta,
        last_test_at: latestStrength.performed_at ?? latestStrength.completed_at ?? null,
        categories: cats,
        biggest_gain:
          biggestGain && biggestGain.delta > 0
            ? { label: biggestGain.label, delta: biggestGain.delta }
            : null,
        biggest_loss:
          biggestLoss && biggestLoss.delta < 0
            ? { label: biggestLoss.label, delta: biggestLoss.delta }
            : null,
      };
    }

    // ---- Signal + Status via zentraler Regellogik
    const compliance = pct(week);
    const prevCompliance = pct(prevWeek);
    const complianceDelta =
      compliance != null && prevCompliance != null ? compliance - prevCompliance : null;
    const signal = {
      user_id: data.userId,
      name: displayName,
      position: teamMembership?.position ?? null,
      team_id: teamMembership?.team_id ?? null,
      team_name: teamMembership?.team_id
        ? teamNameById.get(teamMembership.team_id) ?? null
        : null,
      compliance,
      prev_compliance: prevCompliance,
      compliance_delta: complianceDelta,
      days_inactive: daysInactive,
      onboarding_completed: !!membership.onboarding_completed,
    };
    const statusKey = classifyAthlete(signal);

    // ---- Radar-Trigger (rekonstruiert aus denselben Signalen)
    const radarTriggers: Array<{ kind: string; label: string; detail: string }> = [];
    if (daysInactive != null && daysInactive >= 14) {
      radarTriggers.push({ kind: "inactivity", label: "Inaktivität", detail: `${daysInactive} Tage keine Aktivität` });
    } else if (daysInactive != null && daysInactive >= 7) {
      radarTriggers.push({ kind: "inactivity", label: "Inaktivität", detail: `${daysInactive} Tage keine Aktivität` });
    }
    if (complianceDelta != null && complianceDelta <= -10) {
      radarTriggers.push({
        kind: "compliance",
        label: "Compliance ↓",
        detail: `${complianceDelta} Prozentpunkte ggü. Vorwoche`,
      });
    } else if (complianceDelta != null && complianceDelta >= 20) {
      radarTriggers.push({
        kind: "compliance",
        label: "Compliance ↑",
        detail: `+${complianceDelta} Prozentpunkte ggü. Vorwoche`,
      });
    }
    if (compliance != null && compliance < 40) {
      radarTriggers.push({
        kind: "compliance_low",
        label: "Compliance niedrig",
        detail: `nur ${compliance} % in dieser Woche`,
      });
    }
    // Aufeinanderfolgende, nicht abgeschlossene Athletik-Einheiten (letzte 3)
    const athleticSessions = tasks
      .filter((t) => t.task_type === "athletic_training")
      .slice(0, 3);
    const missedStreak = athleticSessions.every(
      (t) => t.status === "missed" || t.status === "skipped" || t.status === "open"
    );
    if (athleticSessions.length >= 2 && missedStreak) {
      radarTriggers.push({
        kind: "training",
        label: "Training",
        detail: `${athleticSessions.length} Athletik-Einheiten in Folge nicht abgeschlossen`,
      });
    }

    // ---- Coach Summary (regelbasiert)
    const summaryLines: string[] = [];
    if (complianceDelta != null && Math.abs(complianceDelta) >= 10) {
      summaryLines.push(
        `Wochen-Compliance ${complianceDelta > 0 ? "gestiegen" : "gesunken"} um ${Math.abs(
          complianceDelta
        )} Prozentpunkte ggü. Vorwoche (aktuell ${compliance ?? "—"} %).`
      );
    } else if (compliance != null) {
      summaryLines.push(`Wochen-Compliance liegt bei ${compliance} %.`);
    }
    if (daysInactive != null && daysInactive >= 3) {
      summaryLines.push(`Letzte dokumentierte Aktivität liegt ${daysInactive} Tage zurück.`);
    } else if (daysInactive != null) {
      summaryLines.push(`Aktivität aktuell — zuletzt vor ${daysInactive} Tag${daysInactive === 1 ? "" : "en"}.`);
    }
    if (strengthScore != null && strengthDelta != null && strengthSpanWeeks != null) {
      summaryLines.push(
        `Strength Score bei ${strengthScore} (${strengthDelta > 0 ? "+" : ""}${strengthDelta} Punkte in ${strengthSpanWeeks} Woche${
          strengthSpanWeeks === 1 ? "" : "n"
        }).`
      );
    }
    const dataSparse =
      tasks.length < 3 && weights.length < 2 && strengthChecks.length === 0 && lastActivityMs == null;
    if (dataSparse) {
      summaryLines.length = 0;
      summaryLines.push("Noch nicht genügend Daten für eine vollständige Analyse.");
    }

    // ---- Training-Timeline (letzte 10 Einheiten, athletic + team_training)
    const timeline = tasks
      .filter((t) => ["athletic_training", "team_training"].includes(t.task_type))
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        date: t.scheduled_for,
        title: t.title,
        task_type: t.task_type,
        status:
          t.status === "done"
            ? ("done" as const)
            : t.status === "missed" || t.status === "skipped"
            ? ("missed" as const)
            : t.status === "open" || t.status === "pending"
            ? ("open" as const)
            : ("other" as const),
        link_target: t.link_target,
      }));

    // ---- Offene Punkte
    const openItems: Array<{ label: string; count: number; kind: string }> = [];
    const openAthletic = tasks.filter(
      (t) => t.task_type === "athletic_training" && t.status !== "done" && t.status !== "missed" && t.status !== "skipped"
    ).length;
    if (openAthletic > 0)
      openItems.push({ label: "Offene Athletik-Einheiten", count: openAthletic, kind: "training" });
    const openCheckins = tasks.filter(
      (t) => t.task_type === "checkin" && t.status !== "done"
    ).length;
    if (openCheckins > 0)
      openItems.push({ label: "Offene Check-ins", count: openCheckins, kind: "checkin" });
    const openFeedback = tasks.filter(
      (t) => t.task_type === "training_feedback" && t.status !== "done"
    ).length;
    if (openFeedback > 0)
      openItems.push({ label: "Fehlende Trainingsrückmeldungen", count: openFeedback, kind: "feedback" });

    return {
      org,
      athlete: {
        user_id: data.userId,
        display_name: displayName,
        position: teamMembership?.position ?? null,
        secondary_position: teamMembership?.secondary_position ?? null,
        jersey_number: teamMembership?.jersey_number ?? null,
        team_id: teamMembership?.team_id ?? null,
        team_name: teamMembership?.team_id
          ? teamNameById.get(teamMembership.team_id) ?? null
          : null,
        age,
        height_cm: heightCm,
        current_weight_kg: lastWeight?.weight_kg ?? null,
        weight_measured_at: lastWeight?.measured_at ?? null,
      },
      status: { key: statusKey, label: STATUS_LABEL[statusKey] },
      radar_triggers: radarTriggers,
      summary: { lines: summaryLines, data_sparse: dataSparse },
      pulse: {
        compliance,
        compliance_prev: prevCompliance,
        compliance_delta: complianceDelta,
        training_activity: trainingCur,
        training_activity_prev: trainingPrev,
        training_activity_delta:
          trainingCur != null && trainingPrev != null ? trainingCur - trainingPrev : null,
        strength_score: strengthScore,
        strength_score_delta: strengthDelta,
        strength_score_span_weeks: strengthSpanWeeks,
        last_active_days: daysInactive,
      },
      compliance: {
        current_week: compliance,
        prev_week: prevCompliance,
        four_week_avg: fourWeekAvg,
        team_avg: teamAvg,
        diff_to_team: compliance != null && teamAvg != null ? compliance - teamAvg : null,
      },
      training: {
        window_days: 30,
        assigned: month.total,
        done: month.done,
        open: month.open,
        missed: month.missed,
        completion_rate: pct(month),
        timeline,
      },
      weight_series: weights.map((w) => ({
        measured_at: w.measured_at,
        weight_kg: w.weight_kg,
      })),
      weight_trend_kg_30d: weightTrend30d,
      strength: strengthPayload,
      open_items: openItems,
    };
  });
