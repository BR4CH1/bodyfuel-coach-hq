import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      .select("display_name")
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

    const { data: todayTasks } = await supabase
      .from("organization_tasks")
      .select("id, task_type, title, subtitle, scheduled_for, duration_min, status, link_target")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .gte("scheduled_for", start.toISOString())
      .lt("scheduled_for", end.toISOString())
      .order("scheduled_for", { ascending: true });

    // Next open tasks (next 7 days)
    const nextEnd = new Date(start);
    nextEnd.setDate(nextEnd.getDate() + 7);
    const { data: nextTasks } = await supabase
      .from("organization_tasks")
      .select("id, task_type, title, subtitle, scheduled_for, status, link_target")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("status", "open")
      .gte("scheduled_for", start.toISOString())
      .lt("scheduled_for", nextEnd.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(6);

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

    // Weekly compliance: done tasks / total tasks this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const { data: weekTasks } = await supabase
      .from("organization_tasks")
      .select("status")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .gte("scheduled_for", weekStart.toISOString());
    const total = (weekTasks ?? []).length;
    const done = (weekTasks ?? []).filter((t: any) => t.status === "done").length;
    const weeklyCompliance = total > 0 ? Math.round((done / total) * 100) : null;

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
      next_tasks: nextTasks ?? [],
      active_challenge: activeChallenge,
      challenge_progress: challengeProgress,
      weekly_compliance: weeklyCompliance,
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
        .from("organization_tasks")
        .select("id, task_type, title, scheduled_for, status, duration_min")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .in("task_type", ["athletic_training", "team_training"])
        .gte("scheduled_for", weekStart.toISOString())
        .lt("scheduled_for", weekEnd.toISOString())
        .order("scheduled_for", { ascending: true }),
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

    return {
      org,
      plan: (planRes.data ?? [])[0] ?? null,
      week: weekRes.data ?? [],
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
      team_id: string;
      primary_position: string;
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
    const { error } = await supabase
      .from("organization_memberships")
      .update({ onboarding_completed: true })
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);

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

    // Authorization: coach role OR org admin/staff on this org
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    const { data: callerStaff } = await supabase
      .from("staff_assignments")
      .select("id, role, permissions, team_id")
      .eq("user_id", userId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (!isCoach && !callerStaff) {
      throw new Error("Kein Zugriff.");
    }


    const [orgRes, teamsRes, membersRes, staffRes, featuresRes, challengesRes, activityRes] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, slug, organization_type, status, primary_color, logo_url")
          .eq("id", data.orgId)
          .maybeSingle(),
        supabase.from("organization_teams").select("id, name, slug, sport, age_group").eq("organization_id", data.orgId),
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

    const memberIds = ((membersRes.data ?? []) as any[]).map((m) => m.user_id);
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

    // Weekly compliance across all athletes
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const { data: weekTasks } = await supabase
      .from("organization_tasks")
      .select("status, user_id")
      .eq("organization_id", data.orgId)
      .gte("scheduled_for", weekStart.toISOString());
    const totalTasks = (weekTasks ?? []).length;
    const doneTasks = (weekTasks ?? []).filter((t: any) => t.status === "done").length;
    const weeklyCompliance = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null;

    // Team memberships for positions
    const teamIds = ((teamsRes.data ?? []) as any[]).map((t) => t.id);
    let teamMemberships: any[] = [];
    if (teamIds.length && memberIds.length) {
      const { data } = await supabase
        .from("team_memberships")
        .select("user_id, team_id, position")
        .in("team_id", teamIds);
      teamMemberships = data ?? [];
    }

    const athletes = ((membersRes.data ?? []) as any[])
      .filter((m) => m.role === "athlete")
      .map((m) => {
        const tm = teamMemberships.find((t) => t.user_id === m.user_id);
        const team = (teamsRes.data ?? []).find((t: any) => t.id === tm?.team_id);
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

    // Per-team KPI aggregation for leadership drilldown
    const tasksByUser = new Map<string, { total: number; done: number }>();
    for (const t of (weekTasks ?? []) as any[]) {
      const b = tasksByUser.get(t.user_id) ?? { total: 0, done: 0 };
      b.total++; if (t.status === "done") b.done++;
      tasksByUser.set(t.user_id, b);
    }
    const teamKpis = ((teamsRes.data ?? []) as any[]).map((t) => {
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

    // Derive caller experience label
    const callerIsCoach = !!isCoach;
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
      teams: teamsRes.data ?? [],
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
        is_bodyfuel_coach: callerIsCoach,
        team_id: callerStaff?.team_id ?? null,
      },
    };
  });

