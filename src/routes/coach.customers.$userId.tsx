import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { AthleteProfileEditor } from "@/components/bodyfuel/AthleteProfileEditor";
import { AiCheckinDraftCard } from "@/components/bodyfuel/AiCheckinDraftCard";
import { CoachBaseDataEditor } from "@/components/bodyfuel/CoachBaseDataEditor";
import { CoachKitchenEquipmentCard } from "@/components/bodyfuel/CoachKitchenEquipmentCard";
import { CoachMessageThread } from "@/components/bodyfuel/CoachMessageThread";
import { CoachStrengthCheckCard } from "@/components/bodyfuel/CoachStrengthCheckCard";
import { CoachTrainingAlertsCard } from "@/components/bodyfuel/CoachTrainingAlertsCard";
import { CoachTrainingGoalCard } from "@/components/bodyfuel/CoachTrainingGoalCard";
import { CoachTrainingSummary } from "@/components/bodyfuel/TrainingTrends";
import { CoachTrialCard } from "@/components/bodyfuel/CoachTrialCard";
import { CustomerCheckinsCard } from "@/components/bodyfuel/CustomerCheckinsCard";
import { CustomerRecentActivityCard } from "@/components/bodyfuel/CustomerRecentActivityCard";
import { CustomerStatusBadge } from "@/components/bodyfuel/CustomerStatusBadge";
import { GoalProjectionCard } from "@/components/bodyfuel/GoalProjectionCard";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { MealWishesCard } from "@/components/bodyfuel/MealWishesCard";
import { NutritionTargetsEditor } from "@/components/bodyfuel/NutritionTargetsEditor";
import { PartnerLinkCard } from "@/components/bodyfuel/PartnerLinkCard";
import { PhotoAssessmentCard } from "@/components/bodyfuel/PhotoAssessmentCard";
import { PlanAdjustmentsCard } from "@/components/bodyfuel/PlanAdjustmentsCard";
import { PlanManagementCard } from "@/components/bodyfuel/PlanManagementCard";
import { ProgressPhotosCard } from "@/components/bodyfuel/ProgressPhotosCard";
import { RecipeInsightsCard } from "@/components/bodyfuel/RecipeInsightsCard";
import { SectionErrorBoundary } from "@/components/bodyfuel/SectionErrorBoundary";
import { SmartNutritionInsightsCard } from "@/components/bodyfuel/SmartNutritionInsightsCard";
import { StepGoalEditor } from "@/components/bodyfuel/StepGoalEditor";
import { TrainingBonusCard } from "@/components/bodyfuel/TrainingBonusCard";
import { TrainingPlanManagementCard } from "@/components/bodyfuel/TrainingPlanManagementCard";
import { TrainingSessionsList } from "@/components/bodyfuel/TrainingSessionsList";
import { WeightProgressChart } from "@/components/bodyfuel/WeightProgressChart";
import { UserAccessDebugCard } from "@/components/admin/UserAccessDebugCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUserGroup } from "@/lib/admin-groups.functions";
import { getCoachRadar } from "@/lib/coach-radar.functions";
import {
  confirmPayment,
  deleteCustomer,
  getCustomerDetail,
  resendInvite,
  sendPasswordReset,
  setCustomerActive,
  setCustomerPassword,
  updateCustomerCoachingInfo,
  updateCustomerPackage,
} from "@/lib/coaching.functions";
import { labelForTrainingGoal } from "@/lib/training-goals";

export const Route = createFileRoute("/coach/customers/$userId")({
  head: () => ({ meta: [{ title: "Kunde — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CustomerDetail />
    </AppLayout>
  ),
});

const CUSTOMER_DETAIL_TIMEOUT_MS = 15_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type CustomerTab =
  | "overview"
  | "ernaehrung"
  | "training"
  | "fortschritt"
  | "messages"
  | "verwaltung";

type FocusItem = {
  title: string;
  detail: string;
  tab: CustomerTab;
  action: string;
};

async function withCustomerDetailTimeout<T>(request: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            "Die Kundendaten konnten nicht geladen werden. Bitte Verbindung prüfen und erneut versuchen.",
          ),
        ),
      CUSTOMER_DETAIL_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function CustomerDetail() {
  const { userId } = useParams({ from: "/coach/customers/$userId" });
  const navigate = useNavigate();
  const getFn = useServerFn(getCustomerDetail);
  const updFn = useServerFn(updateCustomerPackage);
  const payFn = useServerFn(confirmPayment);
  const inviteFn = useServerFn(resendInvite);
  const resetFn = useServerFn(sendPasswordReset);
  const activeFn = useServerFn(setCustomerActive);
  const setPwFn = useServerFn(setCustomerPassword);
  const deleteFn = useServerFn(deleteCustomer);
  const coachingFn = useServerFn(updateCustomerCoachingInfo);
  const groupFn = useServerFn(setUserGroup);
  const radarFn = useServerFn(getCoachRadar);
  const qc = useQueryClient();

  const { data: radar } = useQuery({
    queryKey: ["coach-radar"],
    queryFn: () => radarFn(),
    staleTime: 60_000,
  });
  const radarStatus = (radar?.clients ?? []).find((client) => client.user_id === userId) ?? null;

  const [newPw, setNewPw] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomerTab>("overview");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["customer", userId],
    queryFn: () => withCustomerDetailTimeout(getFn({ data: { user_id: userId } })),
    retry: false,
  });

  const activePkg = data?.packages.find((pkg) => pkg.is_active) ?? data?.packages[0];
  const [price, setPrice] = useState(0);
  const [pkgKey, setPkgKey] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [coachingGoal, setCoachingGoal] = useState("");
  const [nextCheckin, setNextCheckin] = useState("");

  useEffect(() => {
    if (!activePkg) return;
    setPrice(Number(activePkg.price_eur));
    setPkgKey(activePkg.package);
    setStartDate(activePkg.start_date ?? "");
    setEndDate(activePkg.end_date);
  }, [activePkg]);

  useEffect(() => {
    if (!data) return;
    setCoachingGoal((data as any).coaching_goal ?? "");
    setNextCheckin((data as any).next_checkin_date ?? "");
  }, [data]);

  const saveCoaching = useMutation({
    mutationFn: () =>
      coachingFn({
        data: {
          user_id: userId,
          coaching_goal: coachingGoal || null,
          next_checkin_date: nextCheckin || null,
        },
      }),
    onSuccess: () => {
      toast.success("Coaching-Infos gespeichert.");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updFn>[0]["data"]) => updFn({ data: patch }),
    onSuccess: () => {
      toast.success("Gespeichert.");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const confirm = useMutation({
    mutationFn: (paymentId: string) =>
      payFn({ data: { payment_id: paymentId, extend_days: 30 } }),
    onSuccess: () => {
      toast.success("Zahlung bestätigt, Laufzeit verlängert.");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const accessAction = useMutation({
    mutationFn: async (action: "invite" | "reset" | "deactivate" | "activate") => {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      if (action === "invite") return inviteFn({ data: { user_id: userId, origin } });
      if (action === "reset") return resetFn({ data: { user_id: userId, origin } });
      return activeFn({ data: { user_id: userId, active: action === "activate" } });
    },
    onSuccess: (_result, action) => {
      const message = {
        invite: "Einladung erneut versendet.",
        reset: "Passwort-Reset-Mail versendet.",
        activate: "Zugang aktiviert.",
        deactivate: "Zugang deaktiviert.",
      } as const;
      toast.success(message[action]);
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Lade Kundendaten…</p>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="font-display text-lg font-bold">Kundendaten konnten nicht geladen werden</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Die Abfrage hat keine Daten zurückgegeben."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Lade…" : "Erneut versuchen"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/coach/customers">Zurück zu Kunden</Link>
          </Button>
        </div>
      </div>
    );
  }

  const status = data.auth?.status ?? "invited";
  const statusLabel =
    status === "active" ? "Aktiv" : status === "deactivated" ? "Deaktiviert" : "Einladung offen";
  const statusClass =
    status === "active"
      ? "bg-gold/10 text-gold"
      : status === "deactivated"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/20 text-warning";

  const weightMeasurements = (data.measurements ?? []).filter(
    (item: any) => item.weight_kg != null,
  );
  const latestWeightMeasurement = weightMeasurements[0] ?? null;
  const currentWeight =
    latestWeightMeasurement?.weight_kg != null ? Number(latestWeightMeasurement.weight_kg) : null;
  const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
  const comparisonWeight =
    weightMeasurements.find((item: any) => new Date(item.measured_at).getTime() <= thirtyDaysAgo) ??
    (weightMeasurements.length > 1 ? weightMeasurements[weightMeasurements.length - 1] : null);
  const weightDelta30 =
    currentWeight != null && comparisonWeight?.weight_kg != null
      ? currentWeight - Number(comparisonWeight.weight_kg)
      : null;

  const lastActivityIso = (data.auth as any)?.last_activity_at ?? data.auth?.last_sign_in_at ?? null;
  const lastActivityDate = lastActivityIso ? new Date(lastActivityIso) : null;
  const inactiveDays = lastActivityDate
    ? Math.max(0, Math.floor((Date.now() - lastActivityDate.getTime()) / DAY_MS))
    : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextCheckinDate = (data as any).next_checkin_date
    ? new Date(`${(data as any).next_checkin_date}T00:00:00`)
    : null;
  const checkinDays = nextCheckinDate
    ? Math.ceil((nextCheckinDate.getTime() - today.getTime()) / DAY_MS)
    : null;
  const packageEndDate = activePkg?.end_date ? new Date(`${activePkg.end_date}T00:00:00`) : null;
  const packageDaysLeft = packageEndDate
    ? Math.ceil((packageEndDate.getTime() - today.getTime()) / DAY_MS)
    : null;

  const focusItems: FocusItem[] = [];
  if (radarStatus && radarStatus.level !== "green") {
    focusItems.push({
      title: "Coach-Radar",
      detail: radarStatus.primary_reason,
      tab: "fortschritt",
      action: "Prüfen",
    });
  }
  if (checkinDays != null && checkinDays <= 0) {
    focusItems.push({
      title: checkinDays < 0 ? "Check-in überfällig" : "Check-in heute",
      detail:
        checkinDays < 0
          ? `Seit ${Math.abs(checkinDays)} Tag${Math.abs(checkinDays) === 1 ? "" : "en"} fällig.`
          : "Heute ist der nächste Check-in geplant.",
      tab: "fortschritt",
      action: "Check-ins öffnen",
    });
  }
  if (packageDaysLeft != null && packageDaysLeft <= 7) {
    focusItems.push({
      title: packageDaysLeft < 0 ? "Paket abgelaufen" : "Paket läuft bald aus",
      detail:
        packageDaysLeft < 0
          ? `Seit ${Math.abs(packageDaysLeft)} Tag${Math.abs(packageDaysLeft) === 1 ? "" : "en"} abgelaufen.`
          : `Noch ${packageDaysLeft} Tag${packageDaysLeft === 1 ? "" : "e"} Laufzeit.`,
      tab: "verwaltung",
      action: "Mitgliedschaft öffnen",
    });
  }
  if (inactiveDays != null && inactiveDays >= 5) {
    focusItems.push({
      title: "Kunde länger inaktiv",
      detail: `Letzte Aktivität vor ${inactiveDays} Tagen.`,
      tab: "messages",
      action: "Nachricht senden",
    });
  }
  const visibleFocusItems = focusItems.slice(0, 3);

  const profile = (data.profile as any) ?? {};
  const packageLabel = activePkg
    ? activePkg.package === "coaching"
      ? "BodyFuel Coaching"
      : activePkg.package === "smart"
        ? "BodyFuel Smart"
        : activePkg.package
    : null;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Link
          to="/coach/customers"
          className="inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Kunden
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach Cockpit</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold">
                {data.profile?.display_name ?? data.email}
              </h1>
              {radarStatus && <CustomerStatusBadge level={radarStatus.level} size="md" showLabel />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{data.email}</span>
              {data.profile?.phone && <span>{data.profile.phone}</span>}
              {packageLabel && (
                <span>
                  {packageLabel}
                  {activePkg?.end_date
                    ? ` · bis ${new Date(`${activePkg.end_date}T00:00:00`).toLocaleDateString("de-DE")}`
                    : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab("messages")}>
              Nachricht
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setActiveTab("fortschritt")}
              className="bg-gradient-gold text-primary-foreground"
            >
              Check-ins & Fortschritt
            </Button>
          </div>
        </div>
      </header>

      <CustomerTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CockpitStat
              label="Gewicht"
              value={currentWeight != null ? `${currentWeight.toLocaleString("de-DE")} kg` : "—"}
              hint={
                weightDelta30 != null
                  ? `${weightDelta30 > 0 ? "+" : ""}${weightDelta30.toLocaleString("de-DE", {
                      maximumFractionDigits: 1,
                    })} kg im Vergleich`
                  : "Noch kein Verlauf"
              }
            />
            <CockpitStat
              label="Ziel"
              value={
                profile.goal_weight_kg
                  ? `${profile.goal_weight_kg} kg`
                  : labelForTrainingGoal(profile.training_goal)
              }
              hint={(data as any).coaching_goal ? `Coaching: ${(data as any).coaching_goal}` : "Coaching-Ziel"}
            />
            <CockpitStat
              label="Nächster Check-in"
              value={
                nextCheckinDate
                  ? nextCheckinDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
                  : "Nicht geplant"
              }
              hint={
                checkinDays == null
                  ? "Termin festlegen"
                  : checkinDays < 0
                    ? `${Math.abs(checkinDays)} Tage überfällig`
                    : checkinDays === 0
                      ? "Heute"
                      : `in ${checkinDays} Tagen`
              }
            />
            <CockpitStat
              label="Letzte Aktivität"
              value={
                lastActivityDate
                  ? lastActivityDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
                  : "—"
              }
              hint={
                inactiveDays == null
                  ? "Keine Aktivität erfasst"
                  : inactiveDays === 0
                    ? "Heute aktiv"
                    : `vor ${inactiveDays} Tagen`
              }
            />
          </div>

          <SectionErrorBoundary label="Letzte Aktivität">
            <CustomerRecentActivityCard userId={userId} />
          </SectionErrorBoundary>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Coach-Fokus
                </p>
                <h2 className="mt-1 font-display text-xl font-bold">Heute relevant</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Maximal drei Punkte, die eine Entscheidung oder Aktion brauchen.
                </p>
              </div>
              {visibleFocusItems.length === 0 && (
                <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                  Alles im grünen Bereich
                </span>
              )}
            </div>

            {visibleFocusItems.length > 0 ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {visibleFocusItems.map((item) => (
                  <div
                    key={`${item.title}-${item.action}`}
                    className="rounded-xl border border-warning/30 bg-warning/5 p-4"
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setActiveTab(item.tab)}
                    >
                      {item.action}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Aktuell gibt es keinen akuten Handlungsbedarf. Du kannst direkt in Ernährung, Training
                oder Kommunikation springen.
              </p>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              label="Ernährungsplan"
              description="Targets, Plan und Verlauf"
              onClick={() => setActiveTab("ernaehrung")}
            />
            <QuickAction
              label="Trainingsplan"
              description="Plan, Alerts und Strength Check"
              onClick={() => setActiveTab("training")}
            />
            <QuickAction
              label="Check-in auswerten"
              description="Fortschritt, Fotos und Check-ins"
              onClick={() => setActiveTab("fortschritt")}
            />
            <QuickAction
              label="Nachricht senden"
              description="Direkt in den Kundenthread"
              onClick={() => setActiveTab("messages")}
            />
          </section>

        </div>
      )}

      {activeTab === "ernaehrung" && (
        <TabPanel
          title="Ernährung"
          subtitle="Aktuelle Zielwerte, Planstatus und Adhärenz zuerst — Planungsdetails nur bei Bedarf."
        >
          <MacroTargetsCard userId={userId} />
          <SmartNutritionInsightsCard userId={userId} />
          <PlanManagementCard userId={userId} />

          <SubpointDetails
            title="Fallback-Ziele & Wasser"
            subtitle="Nur relevant, wenn kein aktiver Ernährungsplan den Tracker steuert."
          >
            <NutritionTargetsEditor userId={userId} />
          </SubpointDetails>

          <SubpointDetails
            title="Planungsgrundlagen"
            subtitle="Wunschgerichte, Küchenausstattung und Rezeptfeedback für die nächste Planrunde."
          >
            <div className="space-y-5">
              <MealWishesCard userId={userId} mode="coach" />
              <CoachKitchenEquipmentCard userId={userId} />
              <RecipeInsightsCard userId={userId} />
            </div>
          </SubpointDetails>
        </TabPanel>
      )}

      {activeTab === "training" && (
        <TabPanel
          title="Training"
          subtitle="Aktiver Plan, Auffälligkeiten und Entwicklung zuerst — Detaildiagnostik nur bei Bedarf."
        >
          <TrainingPlanManagementCard userId={userId} />
          <CoachTrainingAlertsCard userId={userId} />
          <CoachTrainingSummary clientId={userId} />
          <CoachTrainingGoalCard
            trainingGoal={profile.training_goal ?? null}
            measurements={(data.measurements ?? []) as any}
            goalWeight={profile.goal_weight_kg ?? null}
            goalTargetDate={profile.goal_target_date ?? null}
          />
          <GoalProjectionCard profile={profile} currentWeight={currentWeight} />

          <SubpointDetails
            title="Alltag & Schrittziel"
            subtitle="NEAT-Vorgabe separat anpassen, ohne die Trainingsanalyse zu überladen."
          >
            <StepGoalEditor userId={userId} initial={profile.daily_step_goal ?? 10000} />
          </SubpointDetails>

          <SubpointDetails
            title="Strength Check"
            subtitle="Kraftprofil, Dysbalancen, Einzelwerte und Verlauf."
          >
            <CoachStrengthCheckCard userId={userId} />
          </SubpointDetails>

          <SubpointDetails
            title="Freie Einheiten & Trainingsbonus"
            subtitle="Sport, Kurse, Mobility sowie PR- und Bonusdaten außerhalb des Plan-Kernflows."
          >
            <div className="space-y-5">
              <section className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-display text-base font-bold">Freie Trainingseinheiten</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kurse, Sport, Mobility und andere Einheiten, die der Kunde außerhalb des Plans geloggt hat.
                </p>
                <div className="mt-3">
                  <TrainingSessionsList clientId={userId} days={30} />
                </div>
              </section>
              <TrainingBonusCard userId={userId} isCoach />
            </div>
          </SubpointDetails>
        </TabPanel>
      )}

      {activeTab === "fortschritt" && (
        <TabPanel
          title="Fortschritt & Check-ins"
          subtitle="Check-in lesen → Entwurf prüfen → Maßnahmen entscheiden → Verlauf kontrollieren."
        >
          <SectionErrorBoundary label="Check-ins">
            <CustomerCheckinsCard userId={userId} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="AI Check-in Entwurf">
            <AiCheckinDraftCard userId={userId} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Plan-Anpassungen">
            <PlanAdjustmentsCard userId={userId} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Gewichtsentwicklung">
            <WeightProgressChart
              measurements={(data.measurements ?? []) as any}
              goalWeight={profile.goal_weight_kg ?? null}
              title="Gewichtsentwicklung"
              emptyHint="Sobald der Kunde sein erstes Gewicht einträgt, erscheint hier sein Verlauf."
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Maße & Gewicht">
            <MeasurementsCard measurements={data.measurements ?? []} />
          </SectionErrorBoundary>

          <SubpointDetails
            title="Fortschrittsfotos & Vergleich"
            subtitle="Foto-Sets und Coach-Auswertung zusammen an einem Ort."
          >
            <div className="space-y-5">
              <SectionErrorBoundary label="Fortschrittsfotos">
                <ProgressPhotosCard userId={userId} readOnly />
              </SectionErrorBoundary>
              <SectionErrorBoundary label="Foto-Auswertung">
                <PhotoAssessmentCard userId={userId} isCoach />
              </SectionErrorBoundary>
            </div>
          </SubpointDetails>
        </TabPanel>
      )}

      {activeTab === "messages" && (
        <TabPanel title="Kommunikation" subtitle="Kundenthread und direkte Betreuung.">
          <CoachMessageThread mode="coach" userId={userId} />
        </TabPanel>
      )}

      {activeTab === "verwaltung" && (
        <div className="space-y-6">
          <AdminSection title="Konto & Basisdaten" subtitle="Zugang, Stammdaten und Gruppenrechte.">
            <AccessCard
              data={data}
              status={status}
              statusLabel={statusLabel}
              statusClass={statusClass}
              accessAction={accessAction}
              showDangerZone={showDangerZone}
              setShowDangerZone={setShowDangerZone}
              showPwForm={showPwForm}
              setShowPwForm={setShowPwForm}
              newPw={newPw}
              setNewPw={setNewPw}
              setPwFn={setPwFn}
              deleteFn={deleteFn}
              userId={userId}
              navigate={navigate}
            />

            <ProfileSummary profile={profile} currentWeight={currentWeight} />

            <SubpointDetails
              title="Stammdaten bearbeiten"
              subtitle="Größe, Zielgewicht, Aktivitätslevel und Trainingsziel ändern."
            >
              <CoachBaseDataEditor
                userId={userId}
                currentWeightKg={currentWeight}
                initial={{
                  height_cm: profile.height_cm ?? null,
                  birthdate: profile.birthdate ?? null,
                  gender: profile.gender ?? null,
                  goal_weight_kg: profile.goal_weight_kg ?? null,
                  goal_target_date: profile.goal_target_date ?? null,
                  activity_level: profile.activity_level ?? null,
                  training_goal: profile.training_goal ?? null,
                }}
              />
            </SubpointDetails>

            <SubpointDetails
              title="Trainings- & Sportprofil bearbeiten"
              subtitle="Sportart, Trainingswoche, Verletzungen, Mobility und Leistungskontext."
            >
              <AthleteProfileEditor
                userId={userId}
                mode="coach"
                initial={{
                  sport: profile.sport ?? null,
                  sport_position: profile.sport_position ?? null,
                  sport_level: profile.sport_level ?? null,
                  team_sport: profile.team_sport ?? false,
                  match_days_per_week: profile.match_days_per_week ?? null,
                  practice_days_per_week: profile.practice_days_per_week ?? null,
                  season_phase: profile.season_phase ?? null,
                  class_types: profile.class_types ?? [],
                  class_days_per_week: profile.class_days_per_week ?? null,
                  mobility_frequency: profile.mobility_frequency ?? null,
                  mobility_focus: profile.mobility_focus ?? null,
                  cardio_outside_gym: profile.cardio_outside_gym ?? null,
                  injuries: profile.injuries ?? null,
                  training_experience: profile.training_experience ?? null,
                }}
              />
            </SubpointDetails>

            <GroupsCard
              userId={userId}
              groups={(data as any).groups ?? []}
              onToggle={async (group, enabled) => {
                try {
                  await groupFn({ data: { user_id: userId, group, enabled } });
                  toast.success(enabled ? "Zugang aktiviert." : "Zugang entfernt.");
                  qc.invalidateQueries({ queryKey: ["customer", userId] });
                } catch (toggleError) {
                  toast.error((toggleError as Error).message);
                }
              }}
            />
          </AdminSection>

          <AdminSection
            title="Mitgliedschaft & Zahlungen"
            subtitle="Paket, Laufzeit, Coaching-Infos und Zahlungshistorie."
          >
            <CoachTrialCard userId={userId} />

            {activePkg && (
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h3 className="font-display text-lg font-bold">Aktives Paket</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Paket</Label>
                    <select
                      value={pkgKey}
                      onChange={(event) => setPkgKey(event.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="smart">BodyFuel Smart</option>
                      <option value="coaching">BodyFuel Coaching</option>
                      {(pkgKey === "starter" || pkgKey === "premium") && (
                        <option value={pkgKey}>
                          {pkgKey === "starter" ? "Starter (Legacy)" : "Premium (Legacy)"}
                        </option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Preis (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(Number(event.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Startdatum</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ablaufdatum</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      update.mutate({
                        package_id: activePkg.id,
                        package: pkgKey as "smart" | "coaching" | "starter" | "premium",
                        price_eur: price,
                        start_date: startDate || undefined,
                        end_date: endDate,
                      })
                    }
                    className="bg-gradient-gold text-primary-foreground"
                  >
                    Speichern
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      update.mutate({ package_id: activePkg.id, is_active: !activePkg.is_active })
                    }
                  >
                    {activePkg.is_active ? "Deaktivieren" : "Aktivieren"}
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h3 className="font-display text-lg font-bold">Coaching-Infos</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Diese Werte werden im Kundenprofil angezeigt — der Kunde kann sie nicht ändern.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ziel</Label>
                  <Select value={coachingGoal} onValueChange={setCoachingGoal}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ziel wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="abnehmen">Abnehmen</SelectItem>
                      <SelectItem value="muskelaufbau">Muskelaufbau</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nächster Check-in</Label>
                  <Input
                    type="date"
                    value={nextCheckin}
                    onChange={(event) => setNextCheckin(event.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={() => saveCoaching.mutate()}
                disabled={saveCoaching.isPending}
                className="mt-4 bg-gradient-gold text-primary-foreground"
              >
                Speichern
              </Button>
            </div>

            <PaymentsCard payments={data.payments} onConfirm={(paymentId) => confirm.mutate(paymentId)} />
          </AdminSection>

          <AdminSection
            title="Partner & Verknüpfungen"
            subtitle="Partnerzugänge und technische Diagnose getrennt vom Coaching-Alltag."
          >
            <PartnerLinkCard userId={userId} />
            <details className="rounded-xl border border-border bg-secondary/20 p-4">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Technische Diagnose
              </summary>
              <div className="mt-4">
                <UserAccessDebugCard userId={userId} />
              </div>
            </details>
          </AdminSection>
        </div>
      )}
    </div>
  );
}

function CustomerTabs({ active, onChange }: { active: CustomerTab; onChange: (tab: CustomerTab) => void }) {
  const tabs: Array<[CustomerTab, string]> = [
    ["overview", "Übersicht"],
    ["ernaehrung", "Ernährung"],
    ["training", "Training"],
    ["fortschritt", "Fortschritt"],
    ["messages", "Kommunikation"],
    ["verwaltung", "Verwaltung"],
  ];

  return (
    <nav className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-2xl border border-border bg-background/95 p-1 shadow-sm backdrop-blur">
      <div className="flex min-w-max gap-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              active === key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function CockpitStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function QuickAction({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/20 hover:bg-secondary/30"
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function TabPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function SubpointDetails({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-secondary/10">
      <summary className="cursor-pointer list-none px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground group-open:hidden">
            Öffnen
          </span>
          <span className="hidden shrink-0 text-xs font-semibold text-muted-foreground group-open:inline">
            Schließen
          </span>
        </div>
      </summary>
      <div className="border-t border-border p-4 sm:p-5">{children}</div>
    </details>
  );
}

function AdminSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-secondary/10 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ProfileSummary({ profile, currentWeight }: { profile: any; currentWeight: number | null }) {
  const activity: Record<string, string> = {
    sedentary: "Sitzend",
    light: "Leicht aktiv",
    moderate: "Moderat aktiv",
    active: "Sehr aktiv",
    athlete: "Leistungssport",
  };
  const gender: Record<string, string> = { male: "Männlich", female: "Weiblich", other: "Divers" };
  const row = (label: string, value: string | number | null | undefined) => (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h3 className="font-display text-lg font-bold">Stammdaten</h3>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {row("Trainingsziel", labelForTrainingGoal(profile.training_goal))}
        {row("Aktuelles Gewicht", currentWeight != null ? `${currentWeight} kg` : null)}
        {row("Wunschgewicht", profile.goal_weight_kg ? `${profile.goal_weight_kg} kg` : null)}
        {row(
          "Wunschgewicht bis",
          profile.goal_target_date ? new Date(profile.goal_target_date).toLocaleDateString("de-DE") : null,
        )}
        {row("Aktivitätslevel", activity[profile.activity_level] ?? profile.activity_level)}
        {row("Größe", profile.height_cm ? `${profile.height_cm} cm` : null)}
        {row("Geschlecht", gender[profile.gender] ?? profile.gender)}
        {row(
          "Geburtsdatum",
          profile.birthdate ? new Date(profile.birthdate).toLocaleDateString("de-DE") : null,
        )}
      </div>
    </div>
  );
}

function AccessCard({
  data,
  status,
  statusLabel,
  statusClass,
  accessAction,
  showDangerZone,
  setShowDangerZone,
  showPwForm,
  setShowPwForm,
  newPw,
  setNewPw,
  setPwFn,
  deleteFn,
  userId,
  navigate,
}: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">Zugang</h3>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
        {data.auth?.invited_at && (
          <div>Eingeladen am: {new Date(data.auth.invited_at).toLocaleDateString("de-DE")}</div>
        )}
        {(data.auth as any)?.last_activity_at ? (
          <div>
            Letzte Aktivität: {new Date((data.auth as any).last_activity_at).toLocaleString("de-DE")}
          </div>
        ) : (
          data.auth?.last_sign_in_at && (
            <div>Letzte Aktivität: {new Date(data.auth.last_sign_in_at).toLocaleString("de-DE")}</div>
          )
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => accessAction.mutate("invite")}
          disabled={accessAction.isPending}
          className="bg-gradient-gold text-primary-foreground"
        >
          {status === "invited" ? "Einladung erneut senden" : "Einladung senden"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => accessAction.mutate("reset")}
          disabled={accessAction.isPending}
        >
          Passwort zurücksetzen
        </Button>
        {status === "deactivated" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => accessAction.mutate("activate")}
            disabled={accessAction.isPending}
          >
            Zugang aktivieren
          </Button>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowDangerZone((value: boolean) => !value)}
          className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
        >
          {showDangerZone ? "▾ Erweiterte Aktionen ausblenden" : "▸ Erweiterte Aktionen anzeigen"}
        </button>
        {showDangerZone && (
          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="mb-3 text-[11px] text-muted-foreground">
              Diese Aktionen sind kritisch. Bitte vorsichtig nutzen.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowPwForm((value: boolean) => !value)}>
                Passwort selbst setzen
              </Button>
              {status !== "deactivated" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Zugang wirklich deaktivieren? Der Kunde kann sich nicht mehr einloggen.",
                      )
                    ) {
                      accessAction.mutate("deactivate");
                    }
                  }}
                  disabled={accessAction.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  Zugang deaktivieren
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const name = data.profile?.display_name ?? data.email ?? "diesen Kunden";
                  const confirmation = window.prompt(
                    `Konto von ${name} unwiderruflich löschen?\n\nAlle Pakete und Zahlungen werden ebenfalls entfernt.\n\nZum Bestätigen tippe LÖSCHEN ein:`,
                  );
                  if (confirmation !== "LÖSCHEN") return;
                  try {
                    await deleteFn({ data: { user_id: userId } });
                    toast.success("Kunde gelöscht.");
                    navigate({ to: "/coach/customers" });
                  } catch (deleteError) {
                    toast.error((deleteError as Error).message);
                  }
                }}
                className="text-destructive hover:text-destructive"
              >
                Konto löschen
              </Button>
            </div>
          </div>
        )}
      </div>

      {showPwForm && (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (newPw.length < 8) return toast.error("Mindestens 8 Zeichen.");
            try {
              await setPwFn({ data: { user_id: userId, password: newPw } });
              toast.success("Passwort gesetzt.");
              setNewPw("");
              setShowPwForm(false);
            } catch (passwordError) {
              toast.error((passwordError as Error).message);
            }
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="manual-pw">Neues Passwort</Label>
            <Input
              id="manual-pw"
              type="text"
              value={newPw}
              onChange={(event) => setNewPw(event.target.value)}
              placeholder="Mind. 8 Zeichen"
              className="w-56"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" size="sm" className="bg-gradient-gold text-primary-foreground">
            Speichern
          </Button>
        </form>
      )}
    </div>
  );
}

function PaymentsCard({
  payments,
  onConfirm,
}: {
  payments: any[];
  onConfirm: (paymentId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h3 className="font-display text-lg font-bold">Zahlungshistorie</h3>
      {payments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Noch keine Zahlungen.</p>
      ) : (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-border bg-secondary/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{Number(payment.amount_eur).toFixed(2)} €</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.payment_date} · {payment.method}
                    </p>
                  </div>
                  <PaymentStatus status={payment.status} />
                </div>
                {payment.note && <p className="mt-2 text-xs text-muted-foreground">{payment.note}</p>}
                {payment.status === "pending" && (
                  <Button size="sm" className="mt-3" onClick={() => onConfirm(payment.id)}>
                    Bestätigen
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">Datum</th>
                  <th>Betrag</th>
                  <th>Methode</th>
                  <th>Status</th>
                  <th>Notiz</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-border">
                    <td className="py-2">{payment.payment_date}</td>
                    <td>{Number(payment.amount_eur).toFixed(2)} €</td>
                    <td>{payment.method}</td>
                    <td>
                      <PaymentStatus status={payment.status} />
                    </td>
                    <td className="text-muted-foreground">{payment.note ?? "—"}</td>
                    <td className="text-right">
                      {payment.status === "pending" && (
                        <Button size="sm" onClick={() => onConfirm(payment.id)}>
                          Bestätigen
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function PaymentStatus({ status }: { status: string }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
        (status === "confirmed"
          ? "bg-gold/10 text-gold"
          : status === "pending"
            ? "bg-warning/20 text-warning"
            : "bg-muted text-muted-foreground")
      }
    >
      {status}
    </span>
  );
}

function MeasurementsCard({ measurements }: { measurements: any[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!measurements.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Maße & Gewicht</h2>
        <p className="mt-3 text-sm text-muted-foreground">Noch keine Maße erfasst.</p>
      </div>
    );
  }

  const latest = measurements[0];
  const visible = showAll ? measurements : measurements.slice(0, 5);
  const fmt = (value: any, unit: string) =>
    value == null || value === "" ? "—" : `${Number(value).toLocaleString("de-DE")} ${unit}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Maße & Gewicht</h2>
        <span className="text-xs text-muted-foreground">
          Aktuell: {new Date(latest.measured_at).toLocaleDateString("de-DE")}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Gewicht" value={fmt(latest.weight_kg, "kg")} />
        <Stat label="Körperfett" value={fmt(latest.body_fat_pct, "%")} />
        <Stat label="Muskelmasse" value={fmt(latest.muscle_mass_kg, "kg")} />
        <Stat label="Bauchumfang" value={fmt(latest.waist_cm, "cm")} />
        <Stat label="Brust" value={fmt(latest.chest_cm, "cm")} />
        <Stat label="Oberschenkel L" value={fmt(latest.thigh_left_cm, "cm")} />
        <Stat label="Oberschenkel R" value={fmt(latest.thigh_right_cm, "cm")} />
        <Stat label="Bizeps L" value={fmt(latest.biceps_left_cm, "cm")} />
        <Stat label="Bizeps R" value={fmt(latest.biceps_right_cm, "cm")} />
      </div>

      <div className="mt-6 space-y-2 md:hidden">
        {visible.map((measurement) => (
          <div key={measurement.id} className="rounded-xl border border-border bg-secondary/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{fmt(measurement.weight_kg, "kg")}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(measurement.measured_at).toLocaleDateString("de-DE")}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>KFA: {fmt(measurement.body_fat_pct, "%")}</span>
              <span>Bauch: {fmt(measurement.waist_cm, "cm")}</span>
              <span>Muskel: {fmt(measurement.muscle_mass_kg, "kg")}</span>
              <span>Brust: {fmt(measurement.chest_cm, "cm")}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="min-w-[860px] w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2">Datum</th>
              <th>Gewicht</th>
              <th>KFA</th>
              <th>Muskel</th>
              <th>Bauchumfang</th>
              <th>Brust</th>
              <th>OS L</th>
              <th>OS R</th>
              <th>Bi L</th>
              <th>Bi R</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((measurement) => (
              <tr key={measurement.id} className="border-t border-border">
                <td className="py-2">
                  {new Date(measurement.measured_at).toLocaleDateString("de-DE")}
                </td>
                <td>{fmt(measurement.weight_kg, "kg")}</td>
                <td>{fmt(measurement.body_fat_pct, "%")}</td>
                <td>{fmt(measurement.muscle_mass_kg, "kg")}</td>
                <td>{fmt(measurement.waist_cm, "cm")}</td>
                <td>{fmt(measurement.chest_cm, "cm")}</td>
                <td>{fmt(measurement.thigh_left_cm, "cm")}</td>
                <td>{fmt(measurement.thigh_right_cm, "cm")}</td>
                <td>{fmt(measurement.biceps_left_cm, "cm")}</td>
                <td>{fmt(measurement.biceps_right_cm, "cm")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {measurements.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-3 text-xs font-semibold uppercase tracking-wider text-gold hover:underline"
        >
          {showAll ? "Weniger anzeigen" : `Alle ${measurements.length} anzeigen`}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}

type GroupKey = "bulls" | "running_team" | "sgz" | "premium";

function GroupsCard({
  groups,
  onToggle,
}: {
  userId: string;
  groups: string[];
  onToggle: (group: GroupKey, enabled: boolean) => void;
}) {
  const items: { key: GroupKey; label: string; desc: string }[] = [
    {
      key: "bulls",
      label: "Bulls-Mitglied",
      desc: "Zugriff auf den kostenlosen Bulls Performance Hub.",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h3 className="font-display text-lg font-bold">Gruppen & Zugänge</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Schalter sind unabhängig voneinander — ein Nutzer kann mehrere Zugänge gleichzeitig haben.
      </p>
      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const enabled = groups.includes(item.key);
          return (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/30 p-3"
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => onToggle(item.key, event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
