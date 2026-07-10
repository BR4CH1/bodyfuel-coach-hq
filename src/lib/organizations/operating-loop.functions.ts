import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOrgAccess(supabase: any, userId: string, orgId: string, requireStaff = false) {
  const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (isCoach) return true;
  if (requireStaff) {
    const { data: staff } = await supabase
      .from("staff_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!staff) throw new Error("Kein Zugriff.");
    return true;
  }
  const { data: mem } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!mem) {
    const { data: staff } = await supabase
      .from("staff_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!staff) throw new Error("Kein Zugriff.");
  }
  return true;
}

// ============================================================
// COMMUNITY POSTS
// ============================================================

export const listOrgCommunityPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; limit?: number }) => ({
    slug: String(d.slug).toLowerCase().trim(),
    limit: Math.min(Math.max(d.limit ?? 30, 1), 100),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, primary_color, settings")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!org) return { org: null, posts: [], can_post: false };
    const orgId = (org as any).id;
    await assertOrgAccess(supabase, userId, orgId);

    const { data: posts } = await supabase
      .from("organization_community_posts")
      .select("id, team_id, author_user_id, author_role_snapshot, post_type, content, image_path, created_at, status")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    const userIds = Array.from(new Set(((posts ?? []) as any[]).map((p) => p.author_user_id)));
    const nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      for (const p of (profs ?? []) as any[]) nameMap.set(p.id, p.display_name || "Athlet");
    }

    // Sign photo URLs (1h)
    const postsWithUrls: any[] = [];
    for (const p of ((posts ?? []) as any[])) {
      let image_url: string | null = null;
      if (p.image_path) {
        const { data: signed } = await supabase.storage
          .from("community-photos")
          .createSignedUrl(p.image_path, 60 * 60);
        image_url = signed?.signedUrl ?? null;
      }
      postsWithUrls.push({ ...p, image_url, author_name: nameMap.get(p.author_user_id) ?? "Athlet" });
    }

    const allowAthletePosts = ((org as any).settings?.allow_athlete_posts ?? true) === true;
    const { data: staff } = await supabase
      .from("staff_assignments")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();
    const canPost = !!staff || allowAthletePosts;

    return {
      org,
      can_post: canPost,
      is_staff: !!staff,
      posts: postsWithUrls,
    };
  });


export const createOrgCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id?: string | null; post_type?: string; content: string; image_path?: string | null }) => ({
    organization_id: d.organization_id,
    team_id: d.team_id ?? null,
    post_type: d.post_type || "general",
    content: String(d.content || "").trim().slice(0, 5000),
    image_path: d.image_path ? String(d.image_path).trim() : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.content && !data.image_path) throw new Error("Beitrag darf nicht leer sein.");
    if (data.image_path) {
      const parts = data.image_path.split("/");
      if (parts[0] !== data.organization_id || parts[1] !== userId) {
        throw new Error("Ungültiger Foto-Pfad");
      }
    }
    // Determine author role snapshot
    const [staffRes, coachRes] = await Promise.all([
      supabase.from("staff_assignments").select("role").eq("user_id", userId).eq("organization_id", data.organization_id).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
    ]);
    const roleSnap = coachRes.data ? "coach" : staffRes.data ? (staffRes.data as any).role : "athlete";
    const { data: inserted, error } = await supabase
      .from("organization_community_posts")
      .insert({
        organization_id: data.organization_id,
        team_id: data.team_id,
        author_user_id: userId,
        author_role_snapshot: roleSnap,
        post_type: data.post_type,
        content: data.content,
        image_path: data.image_path,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as any).id };
  });


// ============================================================
// CHALLENGES: rules + ledger + ranking
// ============================================================

export const getOrgChallengeRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).toLowerCase().trim() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!org) return null;
    const orgId = (org as any).id;
    await assertOrgAccess(supabase, userId, orgId);

    // Active challenge
    const { data: challenges } = await supabase
      .from("organization_challenges")
      .select("id, name, description, starts_at, ends_at, visibility_scope")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("starts_at", { ascending: false });

    const active = (challenges ?? [])[0] as any;
    if (!active) {
      // Past completed challenges
      const { data: past } = await supabase
        .from("organization_challenges")
        .select("id, name, ends_at")
        .eq("organization_id", orgId)
        .eq("status", "archived")
        .order("ends_at", { ascending: false })
        .limit(5);
      return { org, active_challenge: null, entries: [], past_challenges: past ?? [], my_rank: null };
    }

    // Aggregate from ledger
    const { data: events } = await supabase
      .from("organization_challenge_point_events")
      .select("user_id, points")
      .eq("challenge_id", active.id);
    const totals = new Map<string, number>();
    for (const e of (events ?? []) as any[]) {
      totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + (e.points || 0));
    }
    // Fallback: legacy organization_challenge_progress rows
    if (!events?.length) {
      const { data: legacy } = await supabase
        .from("organization_challenge_progress")
        .select("user_id, points")
        .eq("challenge_id", active.id);
      for (const p of (legacy ?? []) as any[]) totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + p.points);
    }

    const userIds = Array.from(totals.keys());
    const nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      for (const p of (profs ?? []) as any[]) nameMap.set(p.id, p.display_name || "Athlet");
    }
    const entries = Array.from(totals.entries())
      .map(([uid, pts]) => ({ user_id: uid, name: nameMap.get(uid) ?? "Athlet", points: pts }))
      .sort((a, b) => b.points - a.points);
    const myRank = entries.findIndex((e) => e.user_id === userId);
    return {
      org,
      active_challenge: active,
      entries,
      past_challenges: [],
      my_rank: myRank >= 0 ? myRank + 1 : null,
    };
  });

export const createOrgChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    team_id?: string | null;
    name: string;
    description?: string | null;
    starts_at: string;
    ends_at?: string | null;
    visibility_scope?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.organization_id, true);
    const { data: ch, error } = await supabase
      .from("organization_challenges")
      .insert({
        organization_id: data.organization_id,
        team_id: data.team_id ?? null,
        name: data.name,
        description: data.description ?? null,
        starts_at: data.starts_at,
        ends_at: data.ends_at ?? null,
        visibility_scope: data.visibility_scope ?? "organization",
        status: "active",
        created_by: userId,
        config: {},
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ch as any).id };
  });

export const listOrgChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.organization_id);
    const { data: challenges } = await supabase
      .from("organization_challenges")
      .select("id, name, status, starts_at, ends_at, visibility_scope, team_id, rules:organization_challenge_rules(count)")
      .eq("organization_id", data.organization_id)
      .order("starts_at", { ascending: false });
    const enriched = (challenges ?? []).map((c: any) => ({
      ...c,
      rule_count: Array.isArray(c.rules) ? (c.rules[0]?.count ?? 0) : 0,
    }));
    return { challenges: enriched };
  });

export const listChallengeRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { challenge_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rules } = await supabase
      .from("organization_challenge_rules")
      .select("id, rule_type, title, description, points, frequency, max_per_day, max_total, config, active")
      .eq("challenge_id", data.challenge_id)
      .order("created_at", { ascending: true });
    return { rules: rules ?? [] };
  });

export const upsertChallengeRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    challenge_id: string;
    rule_type: string;
    title: string;
    description?: string | null;
    points: number;
    frequency: string;
    max_per_day?: number | null;
    max_total?: number | null;
    config?: Record<string, unknown>;
    active?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload: any = {
      challenge_id: data.challenge_id,
      rule_type: data.rule_type,
      title: data.title,
      description: data.description ?? null,
      points: data.points,
      frequency: data.frequency,
      max_per_day: data.max_per_day ?? null,
      max_total: data.max_total ?? null,
      config: (data.config ?? {}) as any,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await supabase.from("organization_challenge_rules").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: r, error } = await supabase.from("organization_challenge_rules").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (r as any).id };
  });


export const awardChallengeBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { challenge_id: string; user_id: string; points: number; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ch } = await supabase
      .from("organization_challenges")
      .select("id, organization_id")
      .eq("id", data.challenge_id)
      .maybeSingle();
    if (!ch) throw new Error("Challenge nicht gefunden.");
    await assertOrgAccess(supabase, userId, (ch as any).organization_id, true);
    const { error } = await supabase.from("organization_challenge_point_events").insert({
      organization_id: (ch as any).organization_id,
      challenge_id: data.challenge_id,
      user_id: data.user_id,
      rule_id: null,
      source_type: "manual_bonus",
      source_id: null,
      points: data.points,
      metadata: { reason: data.reason ?? null },
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ATHLETIC PLANS
// ============================================================

export const listOrgAthleticPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.organization_id);
    const { data: plans } = await supabase
      .from("organization_athletic_plans")
      .select("id, name, description, sport, position, focus_areas, start_date, end_date, status, team_id, user_id, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    return { plans: plans ?? [] };
  });

export const createOrgAthleticPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    name: string;
    description?: string | null;
    sport?: string | null;
    position?: string | null;
    team_id?: string | null;
    focus_areas?: string[];
    start_date?: string | null;
    end_date?: string | null;
    status?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.organization_id, true);
    const { data: plan, error } = await supabase
      .from("organization_athletic_plans")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        description: data.description ?? null,
        sport: data.sport ?? null,
        position: data.position ?? null,
        team_id: data.team_id ?? null,
        user_id: null,
        focus_areas: data.focus_areas ?? [],
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
        status: data.status ?? "draft",
        payload: {},
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (plan as any).id };
  });

export const updateOrgAthleticPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("organization_athletic_plans")
      .update({ status: data.status, updated_by: userId })
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOrgAthleticSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sess } = await supabase
      .from("organization_athletic_plan_sessions")
      .select("id, plan_id, session_name, description, estimated_duration_minutes, scheduled_weekdays, focus_areas")
      .eq("id", data.session_id)
      .maybeSingle();
    if (!sess) return null;
    const { data: plan } = await supabase
      .from("organization_athletic_plans")
      .select("id, name, organization_id, team_id")
      .eq("id", (sess as any).plan_id)
      .maybeSingle();
    const { data: exercises } = await supabase
      .from("organization_athletic_plan_exercises")
      .select("id, exercise_id, order_index, sets, reps, duration_seconds, rest_seconds, intensity_target, rir, tempo, notes")
      .eq("session_id", data.session_id)
      .order("order_index", { ascending: true });
    const exIds = ((exercises ?? []) as any[]).map((e) => e.exercise_id).filter(Boolean);
    let libraryMap = new Map<string, any>();
    if (exIds.length) {
      const { data: lib } = await supabase
        .from("coach_exercise_library")
        .select("id, name, exercise_type, primary_muscle, movement_pattern")
        .in("id", exIds);
      for (const l of (lib ?? []) as any[]) libraryMap.set(l.id, l);
    }
    return {
      session: sess,
      plan,
      exercises: ((exercises ?? []) as any[]).map((e) => ({
        ...e,
        library: e.exercise_id ? libraryMap.get(e.exercise_id) ?? null : null,
      })),
    };
  });

export const completeOrgAthleticSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    session_id: string;
    task_id?: string | null;
    duration_minutes?: number | null;
    rating?: number | null;
    notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sess } = await supabase
      .from("organization_athletic_plan_sessions")
      .select("id, plan_id")
      .eq("id", data.session_id)
      .maybeSingle();
    if (!sess) throw new Error("Session nicht gefunden.");
    const { data: plan } = await supabase
      .from("organization_athletic_plans")
      .select("id, organization_id")
      .eq("id", (sess as any).plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan nicht gefunden.");
    const orgId = (plan as any).organization_id;

    const { error } = await supabase.from("organization_athletic_session_completions").insert({
      organization_id: orgId,
      plan_id: (plan as any).id,
      session_id: data.session_id,
      user_id: userId,
      task_id: data.task_id ?? null,
      duration_minutes: data.duration_minutes ?? null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);

    if (data.task_id) {
      await supabase
        .from("organization_tasks")
        .update({ status: "completed" })
        .eq("id", data.task_id)
        .eq("user_id", userId);
    }

    // Award challenge points for any active challenge rule of type
    // 'athletic_training_completed' (per_completion frequency).
    await awardPointsForEvent(supabase, {
      organization_id: orgId,
      user_id: userId,
      rule_types: ["athletic_training_completed"],
      source_type: "athletic_session_completion",
      source_id: data.session_id,
    });

    return { ok: true };
  });

// Helper: given an event, credit any active challenge rule that matches.
async function awardPointsForEvent(
  supabase: any,
  input: {
    organization_id: string;
    user_id: string;
    rule_types: string[];
    source_type: string;
    source_id: string;
  },
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: active } = await supabase
    .from("organization_challenges")
    .select("id")
    .eq("organization_id", input.organization_id)
    .eq("status", "active")
    .lte("starts_at", new Date().toISOString());
  const activeIds = ((active ?? []) as any[]).map((c) => c.id);
  if (!activeIds.length) return;
  const { data: rules } = await supabase
    .from("organization_challenge_rules")
    .select("id, challenge_id, rule_type, points, frequency, max_per_day, max_total, active")
    .in("challenge_id", activeIds)
    .in("rule_type", input.rule_types)
    .eq("active", true);
  for (const rule of ((rules ?? []) as any[])) {
    // Insert; unique index prevents double credit for the same source
    await supabase
      .from("organization_challenge_point_events")
      .insert({
        organization_id: input.organization_id,
        challenge_id: rule.challenge_id,
        user_id: input.user_id,
        rule_id: rule.id,
        source_type: input.source_type,
        source_id: input.source_id,
        points: rule.points,
        event_date: today,
      })
      .then(() => {})
      .catch(() => {});
  }
}

// ============================================================
// STAFF
// ============================================================

export const STAFF_PRESETS: Record<string, { role: string; permissions: string[]; scope_hint?: "org" | "team" }> = {
  ORGANIZATION_ADMIN: {
    role: "organization_admin",
    scope_hint: "org",
    permissions: [
      "view_members", "manage_members",
      "view_training", "manage_training",
      "view_performance", "manage_performance",
      "view_checkins",
      "view_nutrition",
      "manage_challenges", "manage_ranking",
      "manage_community",
      "manage_staff",
      "manage_organization",
    ],
  },
  TEAM_COACH: {
    role: "coach",
    scope_hint: "team",
    permissions: [
      "view_members",
      "view_training", "manage_training",
      "view_checkins",
      "manage_challenges",
      "manage_community",
    ],
  },
  PERFORMANCE_COACH: {
    role: "staff",
    scope_hint: "team",
    permissions: [
      "view_members",
      "view_training", "manage_training",
      "view_performance", "manage_performance",
      "view_checkins",
    ],
  },
  NUTRITION_COACH: {
    role: "staff",
    scope_hint: "org",
    permissions: ["view_members", "view_nutrition"],
  },
  COMMUNITY_MANAGER: {
    role: "staff",
    scope_hint: "org",
    permissions: ["manage_challenges", "manage_ranking", "manage_community"],
  },
  CUSTOM: {
    role: "staff",
    scope_hint: "org",
    permissions: [],
  },
};

export const ALL_PERMISSIONS = [
  "view_members", "manage_members",
  "view_training", "manage_training",
  "view_performance", "manage_performance",
  "view_checkins",
  "view_nutrition",
  "manage_challenges", "manage_ranking",
  "manage_community",
  "manage_staff",
  "manage_organization",
] as const;

export const addOrgStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    email?: string;
    user_id?: string;
    team_id?: string | null;
    role: string;
    permissions: string[];
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [isCoachRes, isAdminRes] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
      supabase.rpc("is_org_admin", { _user: userId, _org: data.organization_id }),
    ]);
    if (!isCoachRes.data && !isAdminRes.data) throw new Error("Kein Zugriff.");

    let targetUserId = data.user_id ?? null;
    let existingUserFound = false;

    if (!targetUserId && data.email) {
      // Try to find an existing user by email (SECURITY DEFINER against auth.users).
      const { data: found } = await (supabase as any).rpc("find_user_id_by_email", {
        _email: data.email.toLowerCase().trim(),
      });
      if (found) {
        targetUserId = found as string;
        existingUserFound = true;
      }
    }

    if (targetUserId) {
      const { error } = await supabase.from("staff_assignments").upsert(
        {
          user_id: targetUserId,
          organization_id: data.organization_id,
          team_id: data.team_id ?? null,
          role: data.role as any,
          permissions: data.permissions,
        } as any,
        { onConflict: "user_id,organization_id,team_id" } as any,
      );
      if (error) throw new Error(error.message);
      return { ok: true, existing_user: existingUserFound };
    }

    if (!data.email) throw new Error("Bitte User oder E-Mail angeben.");
    const inviteToken = crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error: invErr } = await supabase
      .from("organization_invites")
      .insert({
        organization_id: data.organization_id,
        email: data.email.toLowerCase().trim(),
        assigned_role: data.role as any,
        team_id: data.team_id ?? null,
        permissions: data.permissions as any,
        created_by: userId,
        invite_token: inviteToken,
        status: "pending" as any,
      } as any)
      .select("id")
      .single();
    if (invErr) throw new Error(invErr.message);

    // Send invitation email via the transactional email pipeline.
    // Any failure here must not roll back the invite row; the coach can
    // resend later.
    try {
      const [{ data: org }, { data: team }] = await Promise.all([
        supabase
          .from("organizations")
          .select("slug, name")
          .eq("id", data.organization_id)
          .maybeSingle(),
        data.team_id
          ? supabase.from("organization_teams").select("name").eq("id", data.team_id).maybeSingle()
          : Promise.resolve({ data: null as { name: string } | null }),
      ]);
      const [{ data: inviterProfile }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      ]);
      const roleLabelMap: Record<string, string> = {
        organization_admin: "Vereinsleitung / Administrator",
        coach: "Head Coach / Teamcoach",
        staff: "Trainer / Mitarbeiter",
      };
      const request = getRequest();
      const origin = request?.headers.get("origin")
        ?? (() => {
             const host = request?.headers.get("host");
             const proto = request?.headers.get("x-forwarded-proto") ?? "https";
             return host ? `${proto}://${host}` : "https://bodyfuel-coaching.com";
           })();
      const inviteUrl = org?.slug
        ? `${origin}/${org.slug}/invite/${inviteToken}`
        : `${origin}/invite/${inviteToken}`;
      const authHeader = request?.headers.get("authorization");
      if (authHeader) {
        const sendRes = await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            templateName: "staff-invite",
            recipientEmail: data.email.toLowerCase().trim(),
            idempotencyKey: `staff-invite:${(inv as any).id}`,
            templateData: {
              organizationName: (org as any)?.name ?? "BODYFUEL",
              roleLabel: roleLabelMap[data.role] ?? data.role,
              scopeLabel: team?.name ? `Team: ${team.name}` : "Gesamter Verein",
              inviteUrl,
              inviterName: (inviterProfile as any)?.display_name ?? undefined,
            },
          }),
        });
        if (!sendRes.ok) {
          const body = await sendRes.text();
          console.error("[addOrgStaff] transactional send failed", sendRes.status, body);
        }
      } else {
        console.warn("[addOrgStaff] no auth header available, invite email not sent");
      }
    } catch (e) {
      console.error("[addOrgStaff] invite email dispatch error", e);
    }

    return { invited_id: (inv as any).id, invited: true };
  });

export const updateOrgStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; role?: string; permissions?: string[]; team_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = {};
    if (data.role) patch.role = data.role;
    if (data.permissions) patch.permissions = data.permissions;
    if (data.team_id !== undefined) patch.team_id = data.team_id;
    const { error } = await supabase.from("staff_assignments").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Staff entfernen. Zwei Modi:
 *  - Standard: nur staff_assignment löschen (Person bleibt BODYFUEL-User).
 *  - `delete_account: true`: gesamten BODYFUEL-Account löschen (Auth + Profile
 *    + alle Zugehörigkeiten). Nur für Plattform-Coach oder Organization Admin
 *    des betroffenen Vereins.
 */
export const removeOrgStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; delete_account?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ziel-Assignment laden für Auth-Checks.
    const { data: target, error: tErr } = await supabase
      .from("staff_assignments")
      .select("id, user_id, organization_id, role")
      .eq("id", data.id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target) throw new Error("Staff-Zuweisung nicht gefunden.");

    if ((target as any).user_id === userId) {
      throw new Error("Du kannst dich nicht selbst entfernen.");
    }

    const [{ data: isCoach }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
      supabase.rpc("is_org_admin", { _user: userId, _org: (target as any).organization_id }),
    ]);
    if (!isCoach && !isAdmin) {
      throw new Error("Keine Berechtigung, Mitarbeiter zu entfernen.");
    }

    if (!data.delete_account) {
      const { error } = await supabase.from("staff_assignments").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, deleted_account: false };
    }

    // Vollständige Account-Löschung — nutzt Service Role, um Auth-User + alle
    // Zugehörigkeiten zu bereinigen. Reihenfolge folgt dem Muster aus
    // deleteOrgAthlete.
    const targetUserId = (target as any).user_id as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("payment_history").delete().eq("user_id", targetUserId);
    await supabaseAdmin.from("customer_packages").delete().eq("user_id", targetUserId);
    await supabaseAdmin.from("staff_assignments").delete().eq("user_id", targetUserId);
    await supabaseAdmin.from("organization_memberships").delete().eq("user_id", targetUserId);
    await supabaseAdmin.from("team_memberships").delete().eq("user_id", targetUserId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
    await supabaseAdmin.from("profiles").delete().eq("id", targetUserId);

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true, deleted_account: true };
  });

/** List pending staff invites for an org. */
export const listOrgStaffInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("organization_invites")
      .select("id, email, assigned_role, team_id, status, expires_at, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeOrgStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("organization_invites")
      .update({ status: "revoked" as any })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Accept an invite as the currently-signed-in user. */
export const acceptOrgStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invite_token: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: result, error } = await (context.supabase as any).rpc("accept_organization_invite", {
      _token: data.invite_token,
      _user_id: userId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

// ============================================================
// DAILY CHECK-IN ORG CONTEXT
// ============================================================

/** Called when an athlete opens /daily-check with ?org=<slug>&task=<id>. */
export const attachDailyCheckOrgContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { org_slug: string; task_id?: string | null; check_date?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", data.org_slug.toLowerCase())
      .maybeSingle();
    if (!org) return { ok: false };
    const orgId = (org as any).id;
    const checkDate = data.check_date ?? new Date().toISOString().slice(0, 10);

    // Try to find or create the daily_checks row and mark org context.
    // We DO NOT overwrite non-org check-ins if already present without org.
    const { data: existing } = await supabase
      .from("daily_checks")
      .select("id, organization_id")
      .eq("user_id", userId)
      .eq("check_date", checkDate)
      .maybeSingle();

    if (existing && !(existing as any).organization_id) {
      await supabase
        .from("daily_checks")
        .update({ organization_id: orgId, source_task_id: data.task_id ?? null })
        .eq("id", (existing as any).id);
    }

    // Mark task completed if provided and daily_check exists
    if (data.task_id && existing) {
      await supabase
        .from("organization_tasks")
        .update({ status: "completed" })
        .eq("id", data.task_id)
        .eq("user_id", userId);

      // Award challenge points for daily_checkin rules
      await awardPointsForEvent(supabase, {
        organization_id: orgId,
        user_id: userId,
        rule_types: ["daily_checkin"],
        source_type: "daily_check",
        source_id: (existing as any).id,
      });
    }
    return { ok: true, organization_id: orgId };
  });
