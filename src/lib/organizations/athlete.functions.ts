import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCoachTeamScope } from "./coach-team-scope";
import { scoreOfCheckin, summarize } from "@/lib/readiness";


/** Home data: today's tasks + status cards + active challenge. Membership-scoped. */
export const getOrgHomeData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).toLowerCase().trim() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: org, error: oErr } = await supabase
      .from("organizations")
      .select("id, name, slug, primary_color, secondary_color, logo_url")
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!org) return null;
    const orgId = (org as any).id as string;

    // Membership check (403 if not a member; staff/coach also allowed).
    const [memRes, staffRes, coachRes] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select("role, status, onboarding_completed")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("staff_assignments")
        .select("role, permissions")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
    ]);
    const membership = memRes.data as any;
    if (!membership && !staffRes.data && !coachRes.data) {
      throw new Error("Kein Zugriff auf diese Organisation.");
    }

    // Profile (name)
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();


    // Team membership for this org
    const { data: teams } = await supabase
      .from("organization_teams")
      .select("id, name, slug")
      .eq("organization_id", orgId)
      .eq("status", "active");

    const teamIds = (teams ?? []).map((t: any) => t.id);
    let teamMembership: any = null;
    if (teamIds.length > 0) {
      const { data: tm } = await supabase
        .from("team_memberships")
        .select("team_id, position, secondary_position, jersey_number, personal_goal, gym_access, limitations")
        .eq("user_id", userId)
        .in("team_id", teamIds)
        .maybeSingle();
      teamMembership = tm;
    }
    const team = (teams ?? []).find((t: any) => t.id === teamMembership?.team_id) ?? null;

    // Features
    const { data: featuresRow } = await supabase
      .from("organization_features")
      .select("feature, enabled")
      .eq("organization_id", orgId);
    const features = (featuresRow ?? []) as { feature: string; enabled: boolean }[];

    // Today's tasks (00:00 - 24:00 UTC-ish; using local start of day)
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    // Training ≠ Task. Trainings-Task-Typen werden defensiv ausgefiltert.
    const NON_TRAINING_FILTER = (q: any) =>
      q.not("task_type", "in", "(team_training,athletic_training)");

    const { data: todayTasks } = await NON_TRAINING_FILTER(
      supabase
        .from("organization_tasks")
        .select("id, task_type, title, subtitle, scheduled_for, duration_min, status, link_target")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .gte("scheduled_for", start.toISOString())
        .lt("scheduled_for", end.toISOString())
        .order("scheduled_for", { ascending: true }),
    );

    // Today's training sessions (SoT: training_sessions)
    const todayIso = start.toISOString().slice(0, 10);
    const { data: todaySessions } = await supabase
      .from("training_sessions")
      .select("id, name, session_date, status, duration_minutes, focus, training_source, training_type")
      .eq("client_id", userId)
      .eq("organization_id", orgId)
      .eq("session_date", todayIso)
      .order("created_at", { ascending: true });

    // Next open tasks (next 7 days) — ohne Trainings
    const nextEnd = new Date(start);
    nextEnd.setDate(nextEnd.getDate() + 7);
    const { data: nextTasks } = await NON_TRAINING_FILTER(
      supabase
        .from("organization_tasks")
        .select("id, task_type, title, subtitle, scheduled_for, status, link_target")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .eq("status", "open")
        .gte("scheduled_for", start.toISOString())
        .lt("scheduled_for", nextEnd.toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(6),
    );


    // Active challenge for org
    const nowIso = new Date().toISOString();
    const { data: challenges } = await supabase
      .from("organization_challenges")
      .select("id, name, description, starts_at, ends_at, status")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .lte("starts_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(1);
    const activeChallenge = (challenges ?? [])[0] ?? null;

    let challengeProgress: { points: number; rank: number | null } | null = null;
    if (activeChallenge) {
      const { data: myProg } = await supabase
        .from("organization_challenge_progress")
        .select("points")
        .eq("challenge_id", (activeChallenge as any).id)
        .eq("user_id", userId)
        .maybeSingle();
      const { data: allProg } = await supabase
        .from("organization_challenge_progress")
        .select("user_id, points")
        .eq("challenge_id", (activeChallenge as any).id)
        .order("points", { ascending: false });
      const rankIdx = (allProg ?? []).findIndex((r: any) => r.user_id === userId);
      challengeProgress = {
        points: (myProg as any)?.points ?? 0,
        rank: rankIdx >= 0 ? rankIdx + 1 : null,
      };
    }

    // Weekly compliance: done tasks / total tasks this week (Training exkludiert)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const { data: weekTasks } = await supabase
      .from("organization_tasks")
      .select("status")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .not("task_type", "in", "(team_training,athletic_training)")
      .gte("scheduled_for", weekStart.toISOString());
    const total = (weekTasks ?? []).length;
    const done = (weekTasks ?? []).filter((t: any) => t.status === "done").length;
    const weeklyCompliance = total > 0 ? Math.round((done / total) * 100) : null;

    // Readiness: SoT athlete_checkins. Wir laden die letzten 30 Tage und
    // nutzen `summarize`, damit die Data-Sufficiency-Logik zentral greift.
    // Der Home-Status-Kachel zeigt „—", wenn zu wenig Historie vorliegt —
    // ein einzelner Check-in darf NICHT wie ein belastbarer Readiness-Score
    // wirken (siehe READINESS_SUFFICIENCY).
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyIso = thirtyDaysAgo.toISOString().slice(0, 10);
    const { data: recentCheckins } = await supabase
      .from("athlete_checkins")
      .select("checkin_date, sleep, energy, stress, training_feel, pain_level, pain_note")
      .eq("user_id", userId)
      .gte("checkin_date", thirtyIso)
      .order("checkin_date", { ascending: true });

    const { data: todayCheckin } = await supabase
      .from("athlete_checkins")
      .select("id, checkin_date, sleep, energy, stress, training_feel, pain_level, pain_note, notes, weight_kg")
      .eq("user_id", userId)
      .eq("checkin_date", todayIso)
      .maybeSingle();

    const readinessSummary = summarize((recentCheckins ?? []) as any[]);
    // Nur echten Score anzeigen wenn Baseline (>= CURRENT_MIN_HISTORY) erfüllt ist.
    // Ansonsten null → UI zeigt "—" statt eines künstlichen Wertes.
    const readinessScore = readinessSummary.sufficiency.current
      ? (todayCheckin ? scoreOfCheckin(todayCheckin as any) : null)
      : null;


    return {
      org,
      membership,
      staff: staffRes.data ?? null,
      is_super_admin: !!coachRes.data,
      profile: profile ?? null,
      team,
      team_membership: teamMembership,
      features,
      today_tasks: todayTasks ?? [],
      today_sessions: todaySessions ?? [],
      next_tasks: nextTasks ?? [],
      active_challenge: activeChallenge,
      challenge_progress: challengeProgress,
      weekly_compliance: weeklyCompliance,
      today_checkin: todayCheckin ?? null,
      readiness_score: readinessScore,
      readiness_sufficiency: readinessSummary.sufficiency,
      readiness_days_recorded_7: readinessSummary.days_recorded_7,
    };
  });


/** Mark a task done/skipped. */
export const updateOrgTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string; status: "open" | "done" | "skipped" }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organization_tasks")
      .update({ status: data.status })
      .eq("id", data.taskId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Athletic training entry data. */
export const getOrgAthleticTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).toLowerCase().trim() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug, primary_color")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!org) return null;
    const orgId = (org as any).id;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const weekEndIso = new Date(weekEnd.getTime() - 1).toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);

    // Athleten-Kalender liest ausschließlich aus training_sessions (Phase 1b.1 SoT).
    const [planRes, weekRes, teams] = await Promise.all([
      supabase
        .from("organization_athletic_plans")
        .select("id, name, focus_areas, week_start, status")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("training_sessions")
        .select("id, name, session_date, status, duration_minutes, focus, training_source, training_type")
        .eq("client_id", userId)
        .eq("organization_id", orgId)
        .eq("training_source", "coach")
        .gte("session_date", weekStartIso)
        .lte("session_date", weekEndIso)
        .order("session_date", { ascending: true }),
      supabase
        .from("organization_teams")
        .select("id, name")
        .eq("organization_id", orgId),
    ]);

    let teamMembership: any = null;
    const teamIds = (teams.data ?? []).map((t: any) => t.id);
    if (teamIds.length) {
      const { data } = await supabase
        .from("team_memberships")
        .select("position, secondary_position")
        .eq("user_id", userId)
        .in("team_id", teamIds)
        .maybeSingle();
      teamMembership = data;
    }

    // Backwards-kompatibles Shape für die bestehende UI:
    // - `week` als Coach-Session-Liste (Status planned/in_progress/completed/missed)
    // - `today_sessions` als Coach-Sessions für heute (statt organization_tasks)
    const weekRows = (weekRes.data ?? []).map((r: any) => ({
      id: r.id,
      task_type: r.training_type === "team_practice" ? "team_training" : "athletic_training",
      title: r.name,
      scheduled_for: r.session_date,
      status: r.status === "completed" ? "done" : r.status,
      duration_min: r.duration_minutes,
      focus: r.focus,
    }));

    return {
      org,
      plan: (planRes.data ?? [])[0] ?? null,
      week: weekRows,
      today_sessions: weekRows.filter((w: any) => w.scheduled_for === todayIso),
      team_membership: teamMembership,
    };
  });

/** Ranking data — points sorted, org-scoped. */
export const getOrgRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).toLowerCase().trim() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!org) return null;
    const orgId = (org as any).id;

    // Membership check
    const { data: mem } = await supabase
      .from("organization_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!mem) return { org, entries: [], my_rank: null };

    const { data: challenges } = await supabase
      .from("organization_challenges")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "active");
    const challengeIds = (challenges ?? []).map((c: any) => c.id);

    const entries: { user_id: string; name: string; points: number }[] = [];
    if (challengeIds.length) {
      const { data: progress } = await supabase
        .from("organization_challenge_progress")
        .select("user_id, points")
        .in("challenge_id", challengeIds);
      const totals = new Map<string, number>();
      for (const p of (progress ?? []) as any[]) {
        totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + p.points);
      }
      const userIds = Array.from(totals.keys());
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        const nameMap = new Map<string, string>();
        for (const p of (profiles ?? []) as any[]) {
          nameMap.set(p.id, [p.display_name].filter(Boolean).join(" ") || "Athlet");
        }
        for (const [uid, pts] of totals) {
          entries.push({ user_id: uid, name: nameMap.get(uid) ?? "Athlet", points: pts });
        }
        entries.sort((a, b) => b.points - a.points);
      }
    }
    const myRank = entries.findIndex((e) => e.user_id === userId);
    return { org, entries, my_rank: myRank >= 0 ? myRank + 1 : null };
  });

/** Enhanced onboarding v2: writes profile basics, team_memberships extended fields,
 *  optional initial body measurement (weight_kg), and marks onboarding_completed. */
export const completeOrganizationOnboardingV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id?: string | null;
      primary_position?: string | null;
      secondary_position?: string | null;
      jersey_number?: number | null;
      gym_access?: string | null;
      available_training_days?: number[] | null;
      limitations?: string | null;
      personal_goal?: string | null;
      // Basisdaten (nur schreiben wenn übergeben)
      display_name?: string | null;
      nickname?: string | null;
      birthdate?: string | null;
      // Athletische Basisdaten
      height_cm?: number | null;
      weight_kg?: number | null;
      // Performance Nutrition Engine V1 (org-scoped)
      sex_for_energy_calculation?: "MALE" | "FEMALE" | "UNSPECIFIED" | null;
      baseline_daily_activity?:
        | "MOSTLY_SEATED"
        | "MIXED"
        | "PHYSICALLY_ACTIVE"
        | "VERY_PHYSICALLY_ACTIVE"
        | null;
      performance_nutrition_goal?:
        | "FAT_LOSS"
        | "MAINTENANCE"
        | "PERFORMANCE"
        | "MUSCLE_GAIN"
        | null;
    }) => d,
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Profil-Basisdaten aktualisieren (nur Felder, die geliefert wurden).
    const profileUpdate: { display_name?: string; nickname?: string | null; birthdate?: string; height_cm?: number } = {};
    if (data.display_name !== undefined && data.display_name !== null && data.display_name !== "")
      profileUpdate.display_name = data.display_name;
    if (data.nickname !== undefined) profileUpdate.nickname = data.nickname || null;
    if (data.birthdate !== undefined && data.birthdate !== null && data.birthdate !== "")
      profileUpdate.birthdate = data.birthdate;
    if (data.height_cm !== undefined && data.height_cm !== null)
      profileUpdate.height_cm = data.height_cm;
    if (Object.keys(profileUpdate).length > 0) {
      const { error: pErr } = await supabase.from("profiles").update(profileUpdate).eq("id", userId);
      if (pErr) throw new Error(pErr.message);
    }

    // Aktuelles Gewicht in body_measurements ablegen (nur wenn geliefert).
    if (data.weight_kg !== undefined && data.weight_kg !== null && data.weight_kg > 0) {
      const { error: bmErr } = await supabase.from("body_measurements").insert({
        user_id: userId,
        weight_kg: data.weight_kg,
        notes: "onboarding",
      });
      if (bmErr) throw new Error(bmErr.message);
    }

    // Team-Membership + Position sind bei Fitnessstudios optional — wenn kein
    // team_id übergeben wurde, überspringen wir den Upsert komplett.
    if (data.team_id) {
      const { error: tmErr } = await supabase.from("team_memberships").upsert(
        {
          user_id: userId,
          team_id: data.team_id,
          position: data.primary_position || null,
          secondary_position: data.secondary_position || null,
          jersey_number: data.jersey_number ?? null,
          gym_access: data.gym_access || null,
          available_training_days: data.available_training_days ?? null,
          limitations: data.limitations || null,
          personal_goal: data.personal_goal || null,
          status: "active",
        },
        { onConflict: "user_id,team_id" },
      );
      if (tmErr) throw new Error(tmErr.message);
    }

    const { error } = await supabase
      .from("organization_memberships")
      .update({ onboarding_completed: true })
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);

    // Performance Nutrition Engine V1 — org-scoped Energie-/Zielparameter.
    // Nur upserten wenn mindestens ein Feld geliefert wurde; strikt getrennt
    // vom persönlichen BodyFuel-Smart-Kontext (`nutrition_targets`).
    if (
      data.sex_for_energy_calculation !== undefined ||
      data.baseline_daily_activity !== undefined ||
      data.performance_nutrition_goal !== undefined
    ) {
      const { error: pnpErr } = await supabase
        .from("performance_nutrition_profiles")
        .upsert(
          {
            user_id: userId,
            organization_id: data.organization_id,
            sex_for_energy_calculation: data.sex_for_energy_calculation ?? null,
            baseline_daily_activity: data.baseline_daily_activity ?? null,
            performance_goal: data.performance_nutrition_goal ?? null,
          },
          { onConflict: "user_id,organization_id" },
        );
      if (pnpErr) throw new Error(pnpErr.message);
    }

    // Smart-Ernährungsplan-Generierung für Team-Athleten anstoßen:
    //  1) minimales smart_nutrition_profile setzen (completed_at + Trainingstage)
    //  2) Autopilot-Job mit mode='nutrition_only' in die Queue legen.
    // Der Coach betreut den Athletik-/Trainingsplan im Vereinskontext,
    // deshalb wird KEIN Trainingsplan automatisch generiert.
    let autopilot_job_id: string | null = null;
    try {
      const dayMap: Record<number, string> = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
        0: "sunday",
      };
      const training_weekdays =
        data.available_training_days && data.available_training_days.length
          ? data.available_training_days
              .map((n) => dayMap[n])
              .filter((v): v is string => !!v)
          : null;

      const snpPatch: Record<string, any> = {
        user_id: userId,
        completed_at: new Date().toISOString(),
        auto_publish: true,
      };
      if (training_weekdays) snpPatch.training_weekdays = training_weekdays;

      await supabase
        .from("smart_nutrition_profile")
        .upsert(snpPatch as any, { onConflict: "user_id" });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("smart_autopilot_jobs")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        autopilot_job_id = existing.id;
      } else {
        const { data: created } = await supabaseAdmin
          .from("smart_autopilot_jobs")
          .insert({
            user_id: userId,
            status: "pending",
            step: "nutrition",
            mode: "nutrition_only",
          } as any)
          .select("id")
          .single();
        autopilot_job_id = created?.id ?? null;
      }
    } catch (e) {
      // Onboarding nicht blockieren, wenn Queue-Insert fehlschlägt.
      console.error("autopilot enqueue failed", e);
    }

    return { ok: true, autopilot_job_id };
  });

/** Staff-/Coach-Onboarding: Basisdaten + optionale Funktionsbeschreibung.
 *  KEINE Größe, KEIN Gewicht, KEINE Position. */
export const completeStaffOrganizationOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      display_name?: string | null;
      nickname?: string | null;
      birthdate?: string | null;
      function_label?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const profileUpdate: { display_name?: string; nickname?: string | null; birthdate?: string; height_cm?: number } = {};
    if (data.display_name !== undefined && data.display_name !== null && data.display_name !== "")
      profileUpdate.display_name = data.display_name;
    if (data.nickname !== undefined) profileUpdate.nickname = data.nickname || null;
    if (data.birthdate !== undefined && data.birthdate !== null && data.birthdate !== "")
      profileUpdate.birthdate = data.birthdate;
    if (Object.keys(profileUpdate).length > 0) {
      const { error: pErr } = await supabase.from("profiles").update(profileUpdate).eq("id", userId);
      if (pErr) throw new Error(pErr.message);
    }

    const { error: sErr } = await supabase
      .from("staff_assignments")
      .update({
        function_label: data.function_label ?? null,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id);
    if (sErr) throw new Error(sErr.message);

    return { ok: true };
  });

/** Coach: detailed org overview. */
export const getOrgCoachDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Team-Scope zentral ermitteln (wirft "Kein Zugriff." bei fehlender Zuordnung)
    const scope = await resolveCoachTeamScope(supabase, userId, data.orgId);
    const { data: callerStaff } = await supabase
      .from("staff_assignments")
      .select("id, role, permissions, team_id")
      .eq("user_id", userId)
      .eq("organization_id", data.orgId)
      .maybeSingle();

    const allowedTeamIdSet = new Set(scope.allowedTeamIds);
    const teamFilterIds = scope.allTeams ? null : scope.allowedTeamIds;

    const [orgRes, teamsRes, membersRes, staffRes, featuresRes, challengesRes, activityRes] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, slug, organization_type, sport, status, primary_color, logo_url")
          .eq("id", data.orgId)
          .maybeSingle(),
        (teamFilterIds
          ? supabase
              .from("organization_teams")
              .select("id, name, slug, sport, age_group")
              .eq("organization_id", data.orgId)
              .in("id", teamFilterIds)
          : supabase
              .from("organization_teams")
              .select("id, name, slug, sport, age_group")
              .eq("organization_id", data.orgId)),
        supabase
          .from("organization_memberships")
          .select("user_id, role, status, onboarding_completed, joined_at")
          .eq("organization_id", data.orgId),
        supabase.from("staff_assignments").select("id, user_id, role, permissions, team_id").eq("organization_id", data.orgId),
        supabase.from("organization_features").select("feature, enabled").eq("organization_id", data.orgId),
        supabase
          .from("organization_challenges")
          .select("id, name, starts_at, ends_at, status")
          .eq("organization_id", data.orgId)
          .eq("status", "active")
          .limit(1),
        supabase
          .from("organization_activity_log")
          .select("id, event_type, payload, user_id, created_at")
          .eq("organization_id", data.orgId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    const visibleTeams = (teamsRes.data ?? []) as any[];
    const visibleTeamIds = visibleTeams.map((t) => t.id);

    // Team-Memberships für alle Athleten der sichtbaren Teams laden
    const memberIds = ((membersRes.data ?? []) as any[]).map((m) => m.user_id);
    let teamMemberships: any[] = [];
    if (visibleTeamIds.length && memberIds.length) {
      const { data } = await supabase
        .from("team_memberships")
        .select("user_id, team_id, position")
        .in("team_id", visibleTeamIds);
      teamMemberships = data ?? [];
    }

    // Nur Athleten, die zu einem erlaubten Team gehören
    const allowedAthleteIds = new Set(
      teamMemberships
        .filter((tm) => !teamFilterIds || allowedTeamIdSet.has(tm.team_id))
        .map((tm) => tm.user_id),
    );

    // Head Coach / Org Admin dürfen zusätzlich Athleten OHNE Team-Zuordnung sehen
    const showTeamlessAthletes = scope.allTeams;

    let profiles: any[] = [];
    if (memberIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", memberIds);
      profiles = data ?? [];
    }
    const nameMap = new Map<string, { name: string; email: string | null }>();
    for (const p of profiles) {
      nameMap.set(p.id, {
        name: [p.display_name].filter(Boolean).join(" ") || "Athlet",
        email: p.email ?? null,
      });
    }

    // Compliance nur für sichtbare Athleten
    const scopedMemberIds = new Set<string>();
    for (const m of (membersRes.data ?? []) as any[]) {
      if (m.role !== "athlete") continue;
      const hasTeam = teamMemberships.some((tm) => tm.user_id === m.user_id);
      if (allowedAthleteIds.has(m.user_id) || (showTeamlessAthletes && !hasTeam)) {
        scopedMemberIds.add(m.user_id);
      }
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const scopedIds = Array.from(scopedMemberIds);
    const { data: weekTasks } = scopedIds.length
      ? await supabase
          .from("organization_tasks")
          .select("status, user_id")
          .eq("organization_id", data.orgId)
          .in("user_id", scopedIds)
          .gte("scheduled_for", weekStart.toISOString())
      : { data: [] as any[] };
    const totalTasks = (weekTasks ?? []).length;
    const doneTasks = (weekTasks ?? []).filter((t: any) => t.status === "done").length;
    const weeklyCompliance = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null;

    const athletes = ((membersRes.data ?? []) as any[])
      .filter((m) => m.role === "athlete" && scopedMemberIds.has(m.user_id))
      .map((m) => {
        const tm = teamMemberships.find((t) => t.user_id === m.user_id);
        const team = visibleTeams.find((t) => t.id === tm?.team_id);
        const profile = nameMap.get(m.user_id);
        return {
          user_id: m.user_id,
          name: profile?.name ?? "Athlet",
          email: profile?.email ?? null,
          team_name: team?.name ?? null,
          position: tm?.position ?? null,
          onboarding_completed: !!m.onboarding_completed,
          joined_at: m.joined_at,
        };
      });

    // Per-team KPI aggregation (nur sichtbare Teams)
    const tasksByUser = new Map<string, { total: number; done: number }>();
    for (const t of (weekTasks ?? []) as any[]) {
      const b = tasksByUser.get(t.user_id) ?? { total: 0, done: 0 };
      b.total++; if (t.status === "done") b.done++;
      tasksByUser.set(t.user_id, b);
    }
    const teamKpis = visibleTeams.map((t) => {
      const teamAthletes = athletes.filter((a) => {
        const tm = teamMemberships.find((x) => x.user_id === a.user_id);
        return tm?.team_id === t.id;
      });
      let total = 0, done = 0;
      for (const a of teamAthletes) {
        const b = tasksByUser.get(a.user_id);
        if (b) { total += b.total; done += b.done; }
      }
      return {
        team_id: t.id,
        athletes: teamAthletes.length,
        weekly_compliance: total > 0 ? Math.round((done / total) * 100) : null,
        pending_onboardings: teamAthletes.filter((a) => !a.onboarding_completed).length,
      };
    });

    // Caller-Experience Ableitung
    const staffRole = callerStaff?.role ?? null;
    const perms = new Set((callerStaff?.permissions ?? []) as string[]);
    const callerExperience: "org_admin" | "head_coach" | "team_coach" | "staff" | "coach" =
      staffRole === "organization_admin"
        ? "org_admin"
        : staffRole === "coach" && perms.has("manage_organization")
        ? "head_coach"
        : staffRole === "coach"
        ? "team_coach"
        : staffRole === "staff"
        ? "staff"
        : "coach";

    return {
      org: orgRes.data,
      teams: visibleTeams,
      team_kpis: teamKpis,
      athletes,
      staff: staffRes.data ?? [],
      features: featuresRes.data ?? [],
      active_challenge: (challengesRes.data ?? [])[0] ?? null,
      activity: activityRes.data ?? [],
      pending_onboardings: athletes.filter((a) => !a.onboarding_completed).length,
      weekly_compliance: weeklyCompliance,
      caller: {
        experience: callerExperience,
        is_bodyfuel_coach: scope.isGlobalCoach,
        team_id: callerStaff?.team_id ?? null,
        all_teams: scope.allTeams,
        allowed_team_ids: scope.allTeams ? null : scope.allowedTeamIds,
      },
    };
  });



