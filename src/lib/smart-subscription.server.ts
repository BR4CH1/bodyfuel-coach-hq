/**
 * Prüft, ob ein Smart-Kunde aktuell eine bezahlte/aktive Subscription hat.
 * Genutzt von:
 * - manuellem Verlängerungs-Button (Smart Renewal)
 * - automatischen Cron-Hooks (Plan-Rotation / Auto-Regen)
 *
 * Eine Verlängerung ist nur erlaubt, wenn:
 *  - status ∈ (active, trialing, past_due)
 *  - current_period_end > jetzt (oder null = lifetime)
 * `canceled` mit zukünftigem period_end zählt NICHT als Verlängerungs-OK
 * (Kunde hat ja gekündigt, soll keinen neuen Zyklus mehr bekommen).
 */
export async function hasActiveSmartSubscription(
  supabase: any,
  userId: string,
): Promise<{ active: boolean; status: string | null; period_end: string | null }> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { active: false, status: null, period_end: null };

  const okStatus = ["active", "trialing", "past_due"].includes(data.status);
  const periodEndOk =
    !data.current_period_end || new Date(data.current_period_end).getTime() > Date.now();
  const notCanceling = !data.cancel_at_period_end;

  return {
    active: okStatus && periodEndOk && notCanceling,
    status: data.status,
    period_end: data.current_period_end,
  };
}
