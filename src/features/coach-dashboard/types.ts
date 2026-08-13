export type CoachClient = {
  id: string;
  display_name: string | null;
  last_checkin: string | null;
  last_checkin_submitted_at: string | null;
  pending_checkin_week_start: string | null;
  pending_checkin_submitted_at: string | null;
  last_weight: number | null;
  last_weight_at: string | null;
  last_nutrition_at: string | null;
  last_nutrition_name: string | null;
  last_training_at: string | null;
  nutrition_plan_end: string | null;
  training_plan_end: string | null;
  kcal_dev: number | null;
  kcal_dev_dir: "over" | "under" | null;
  plateau_days: number | null;
};

export type CoachLead = {
  id: string;
  name: string;
  email: string;
  goal: string | null;
  created_at: string;
};
export type CoachScoreLevel = "green" | "yellow" | "red";
export type CoachScore = { score: number; level: CoachScoreLevel; reasons: string[] };
export type ScoredCoachClient = CoachClient & { _score: CoachScore };
export type InactiveCoachClient = CoachClient & { days: number | null };
export type ExpiringPlan = {
  id: string;
  name: string;
  kind: "nutrition" | "training";
  end: string;
  days: number;
};
export type CoachProductCounts = {
  coaching: number;
  smart: number;
};
export type CoachDashboardData = {
  clients: CoachClient[];
  leads: CoachLead[];
  productCounts: CoachProductCounts;
};
export type CoachDashboardViewModel = {
  weekStart: string;
  pendingCheckins: CoachClient[];
  openWeek: CoachClient[];
  inactive: InactiveCoachClient[];
  recentMeasurements: CoachClient[];
  recentNutrition: CoachClient[];
  recentTraining: CoachClient[];
  expiringPlans: ExpiringPlan[];
  planOverview: CoachClient[];
  scoreById: Map<string, CoachScore>;
  scoreCounts: Record<CoachScoreLevel, number>;
  redClients: ScoredCoachClient[];
};

export type CoachBriefingTarget =
  | { kind: "customer"; userId: string }
  | { kind: "customers" }
  | { kind: "leads" }
  | { kind: "performance" };
export type CoachBriefingItemTone = "urgent" | "attention" | "info";
export type CoachBriefingItem = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  tone: CoachBriefingItemTone;
  target: CoachBriefingTarget;
};
export type CoachBriefingViewModel = {
  state: "urgent" | "attention" | "clear";
  emotion: "focused" | "motivated" | "celebrating";
  title: string;
  summary: string;
  items: CoachBriefingItem[];
};

export type CoachFollowUpTone = "urgent" | "attention" | "info";
export type CoachFollowUpTarget =
  { kind: "customer"; userId: string } | { kind: "lead"; leadId: string };
export type CoachFollowUpCategory =
  "risk" | "checkin" | "inactive" | "plan" | "lead" | "stagnation" | "attention";
export type CoachFollowUpDraft = {
  id: string;
  sourceSignalId: string;
  recipientName: string;
  category: CoachFollowUpCategory;
  tone: CoachFollowUpTone;
  reason: string;
  message: string;
  emailSubject: string;
  target: CoachFollowUpTarget;
};

export type CoachWorkloadKey = "risk" | "checkin" | "plan" | "lead";
export type CoachWorkloadItem = {
  id: string;
  name: string;
  reason: string;
  target: CoachFollowUpTarget;
  sourceSignalId: string;
};
export type CoachWorkloadMetric = {
  key: CoachWorkloadKey;
  label: "Risiko" | "Check-ins" | "Pläne ≤ 3 Tage" | "Leads";
  value: number;
  tone: "urgent" | "attention" | "info" | "neutral";
  items: CoachWorkloadItem[];
};
export type CoachWorkloadViewModel = {
  state: "critical" | "busy" | "steady" | "clear";
  title: string;
  summary: string;
  total: number;
  metrics: CoachWorkloadMetric[];
};

export type CoachIntelligenceSignal = {
  id: string;
  userId: string;
  name: string;
  category: "stagnation" | "risk" | "attention";
  severity: "urgent" | "attention" | "info";
  headline: string;
  detail: string;
};
export type CoachIntelligenceViewModel = {
  title: string;
  summary: string;
  stagnating: CoachIntelligenceSignal[];
  atRisk: CoachIntelligenceSignal[];
  needsAttention: CoachIntelligenceSignal[];
};
