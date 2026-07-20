import type { FuelyEmotion } from "@/components/bodyfuel/Fuely";

export type CustomerBriefingItemTone = "urgent" | "attention" | "info";

export type CustomerBriefingTarget =
  | { kind: "checkin" }
  | { kind: "daily-checklist" }
  | { kind: "training" }
  | { kind: "measurements" }
  | { kind: "nutrition" };

export type CustomerBriefingItem = {
  id: string;
  tone: CustomerBriefingItemTone;
  title: string;
  description: string;
  actionLabel: string;
  target: CustomerBriefingTarget;
};

export type CustomerBriefingProgress = {
  trainedToday: boolean;
  measuredToday: boolean;
  todayPoints: number;
  maxDailyPoints: number;
};

export type CustomerBriefingViewModel = {
  state: "clear" | "urgent" | "attention";
  emotion: FuelyEmotion;
  title: string;
  summary: string;
  items: CustomerBriefingItem[];
  progress: CustomerBriefingProgress;
};

export type CustomerCheckinBriefing = {
  tone: "overdue" | "today" | "soon" | "future" | "review";
  label: string;
};

export type CustomerMomentumSignal = {
  label: "Training" | "Messung" | "Tagespunkte";
  complete: boolean;
};

export type CustomerMomentumViewModel = {
  state: "start" | "moving" | "strong" | "complete";
  title: string;
  summary: string;
  completion: number;
  signals: CustomerMomentumSignal[];
};
