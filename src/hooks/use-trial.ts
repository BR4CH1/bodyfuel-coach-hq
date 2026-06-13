import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { startMyTrial } from "@/lib/trial.functions";


export type TrialStatus = "none" | "trial" | "trial_expired" | "active";

export type TrialState = {
  loading: boolean;
  status: TrialStatus;
  trial_start: string | null;
  trial_end: string | null;
  daysLeft: number | null;
  isTrial: boolean;
  isExpired: boolean;
  isMember: boolean;
  /** True für Mitglieder UND Coach (Coach hat immer Vollzugriff). */
  hasFullAccess: boolean;
  refresh: () => Promise<void>;
};

function calcDaysLeft(endIso: string | null): number | null {
  if (!endIso) return null;
  const end = new Date(`${endIso}T23:59:59Z`).getTime();
  const diff = Math.ceil((end - Date.now()) / 86_400_000);
  return diff;
}

export function useTrial(): TrialState {
  const { supabaseUser, isCoach } = useSession();
  const [state, setState] = useState<{
    loading: boolean;
    status: TrialStatus;
    trial_start: string | null;
    trial_end: string | null;
  }>({ loading: true, status: "none", trial_start: null, trial_end: null });

  const load = async () => {
    if (!supabaseUser) {
      setState({ loading: false, status: "none", trial_start: null, trial_end: null });
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("trial_status, trial_start, trial_end")
      .eq("id", supabaseUser.id)
      .maybeSingle();
    setState({
      loading: false,
      status: ((data as any)?.trial_status as TrialStatus) ?? "none",
      trial_start: (data as any)?.trial_start ?? null,
      trial_end: (data as any)?.trial_end ?? null,
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUser?.id]);

  let effectiveStatus = state.status;
  const daysLeft = calcDaysLeft(state.trial_end);
  // Lokale Ablauf-Erkennung: trial mit abgelaufenem Enddatum
  if (effectiveStatus === "trial" && daysLeft !== null && daysLeft <= 0) {
    effectiveStatus = "trial_expired";
  }

  const isTrial = effectiveStatus === "trial";
  const isExpired = effectiveStatus === "trial_expired";
  const isMember = effectiveStatus === "active";
  const hasFullAccess = isMember || isCoach || effectiveStatus === "none";

  return {
    loading: state.loading,
    status: effectiveStatus,
    trial_start: state.trial_start,
    trial_end: state.trial_end,
    daysLeft: isTrial ? Math.max(0, daysLeft ?? 0) : daysLeft,
    isTrial,
    isExpired,
    isMember,
    hasFullAccess,
    refresh: load,
  };
}
