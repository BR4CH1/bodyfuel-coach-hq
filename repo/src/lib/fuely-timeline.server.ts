/**
 * Fuely Timeline — server-only Helper zum Einfügen chronologischer
 * Erfolgs-/Aktivitäts-Einträge. Nicht direkt aus Komponenten importieren.
 */

type SB = any;

export type TimelineEventInput = {
  event_type: "morning_briefing" | "evening_review" | "action" | "milestone" | "memory";
  category?: string | null;
  icon?: string | null;
  title: string;
  summary?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  metadata?: Record<string, unknown> | null;
  coach_visible?: boolean;
  occurred_at?: string;
};

export async function insertTimelineEvent(
  supabase: SB,
  userId: string,
  event: TimelineEventInput,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fuely_timeline_events")
    .insert({
      user_id: userId,
      event_type: event.event_type,
      category: event.category ?? null,
      icon: event.icon ?? null,
      title: event.title,
      summary: event.summary ?? null,
      cta_label: event.cta_label ?? null,
      cta_href: event.cta_href ?? null,
      metadata: event.metadata ?? {},
      coach_visible: event.coach_visible ?? false,
      occurred_at: event.occurred_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return null;
  return (data as any)?.id ?? null;
}

/**
 * Meilenstein-Erkennung nach einer Gewichts-Aktion:
 * gibt einen Titel zurück, wenn `weight_kg` ein neues 60-Tage-Tief ist,
 * oder das Zielgewicht erreicht wurde (±0.3 kg).
 */
export async function detectWeightMilestone(
  supabase: SB,
  userId: string,
  weightKg: number,
): Promise<TimelineEventInput | null> {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data } = await supabase
    .from("body_measurements")
    .select("weight_kg, measured_at")
    .eq("user_id", userId)
    .gte("measured_at", since.toISOString().slice(0, 10))
    .not("weight_kg", "is", null);
  const others = (data ?? []).filter((r: any) => Number(r.weight_kg) !== weightKg);
  const min = others.length ? Math.min(...others.map((r: any) => Number(r.weight_kg))) : Infinity;

  const { data: profile } = await supabase
    .from("profiles")
    .select("target_weight_kg, goal")
    .eq("id", userId)
    .maybeSingle();
  const target = Number((profile as any)?.target_weight_kg ?? NaN);
  const goal = String((profile as any)?.goal ?? "");
  if (!Number.isNaN(target) && Math.abs(weightKg - target) <= 0.3) {
    return {
      event_type: "milestone",
      category: "weight",
      icon: "🎯",
      title: "Zielgewicht erreicht",
      summary: `${weightKg.toFixed(1)} kg — dein Ziel ist da.`,
      coach_visible: true,
      metadata: { weight_kg: weightKg, target_kg: target },
    };
  }
  if (weightKg < min - 0.05) {
    const dir = goal.includes("lose") || goal.includes("cut") ? "Neues Tiefstgewicht" : "Neuer Bestwert";
    return {
      event_type: "milestone",
      category: "weight",
      icon: "⚖️",
      title: `${dir}: ${weightKg.toFixed(1)} kg`,
      summary: null,
      coach_visible: true,
      metadata: { weight_kg: weightKg, previous_min_kg: min === Infinity ? null : min },
    };
  }
  return null;
}

/**
 * Prüft, ob nach dem Eintrag heute das Proteinziel erstmals erreicht wurde.
 */
export async function detectProteinGoalMilestone(
  supabase: SB,
  userId: string,
  today: string,
): Promise<TimelineEventInput | null> {
  const [{ data: entries }, { data: target }] = await Promise.all([
    supabase.from("food_entries").select("protein_g").eq("user_id", userId).eq("entry_date", today),
    supabase.from("nutrition_targets").select("protein_g").eq("user_id", userId).maybeSingle(),
  ]);
  const totalProtein = (entries ?? []).reduce((a: number, r: any) => a + Number(r.protein_g ?? 0), 0);
  const targetProtein = Number((target as any)?.protein_g ?? NaN);
  if (!Number.isFinite(targetProtein) || targetProtein <= 0) return null;
  if (totalProtein < targetProtein) return null;

  // Nur einmal pro Tag emittieren
  const { data: existing } = await supabase
    .from("fuely_timeline_events")
    .select("id")
    .eq("user_id", userId)
    .eq("category", "protein_goal")
    .gte("occurred_at", `${today}T00:00:00Z`)
    .limit(1);
  if (existing && existing.length) return null;

  return {
    event_type: "milestone",
    category: "protein_goal",
    icon: "🍗",
    title: "Proteinziel erreicht",
    summary: `${Math.round(totalProtein)} g / ${Math.round(targetProtein)} g`,
    coach_visible: true,
    metadata: { total_g: totalProtein, target_g: targetProtein },
  };
}
