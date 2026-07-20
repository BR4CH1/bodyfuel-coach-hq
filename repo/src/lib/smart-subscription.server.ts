/**
 * Prüft, ob ein Smart-Kunde aktuell eine bezahlte/aktive Subscription hat.
 * Genutzt von:
 * - manuellem Verlängerungs-Button (Smart Renewal)
 * - automatischen Cron-Hooks (Plan-Rotation / Auto-Regen)
 *
 * Akzeptiert wird:
 *  1) Stripe-Subscription: status ∈ (active, trialing, past_due),
 *     current_period_end > jetzt (oder null), nicht cancel_at_period_end.
 *  2) Manuell freigeschaltetes Paket: customer_packages.is_active = true,
 *     package = 'smart', end_date > jetzt (oder null). Dafür gibt es keinen
 *     Stripe-Datensatz (z. B. Coach hat Zahlung manuell bestätigt).
 *
 * `canceled` mit zukünftigem period_end zählt NICHT als Verlängerungs-OK.
 */
export async function hasActiveSmartSubscription(
  supabase: any,
  userId: string,
): Promise<{ active: boolean; status: string | null; period_end: string | null }> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub) {
    const okStatus = ["active", "trialing", "past_due"].includes(sub.status);
    const periodEndOk =
      !sub.current_period_end ||
      new Date(sub.current_period_end).getTime() > Date.now();
    const notCanceling = !sub.cancel_at_period_end;
    if (okStatus && periodEndOk && notCanceling) {
      return {
        active: true,
        status: sub.status,
        period_end: sub.current_period_end,
      };
    }
  }

  // Fallback: manuell bestätigtes Paket (kein Stripe-Datensatz vorhanden)
  const { data: pkg } = await supabase
    .from("customer_packages")
    .select("package, is_active, end_date")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("package", "smart")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pkg) {
    const endOk = !pkg.end_date || new Date(pkg.end_date).getTime() > Date.now();
    if (endOk) {
      return {
        active: true,
        status: "manual",
        period_end: pkg.end_date ?? null,
      };
    }
  }

  return {
    active: false,
    status: sub?.status ?? null,
    period_end: sub?.current_period_end ?? null,
  };
}
