import type {
  CustomerBriefingViewModel,
  CustomerMomentumViewModel,
} from "@/features/customer-dashboard/types";

export function buildCustomerMomentum(
  briefing: CustomerBriefingViewModel,
): CustomerMomentumViewModel {
  const { trainedToday, measuredToday, todayPoints, maxDailyPoints } = briefing.progress;
  const safeMax = Math.max(1, maxDailyPoints);
  const pointsProgress = Math.min(100, Math.max(0, Math.round((todayPoints / safeMax) * 100)));
  const completed = [trainedToday, measuredToday, pointsProgress >= 100].filter(Boolean).length;
  const completion = Math.round((completed / 3) * 100);

  if (completion === 100) {
    return {
      state: "complete",
      title: "Tagesziel komplett",
      summary: "Training, Messung und Tagespunkte sind erledigt. Starker Tag.",
      completion,
      signals: [
        { label: "Training", complete: true },
        { label: "Messung", complete: true },
        { label: "Tagespunkte", complete: true },
      ],
    };
  }

  return {
    state: completion >= 67 ? "strong" : completion >= 34 ? "moving" : "start",
    title:
      completion >= 67
        ? "Fast geschafft"
        : completion >= 34
          ? "Du bist im Flow"
          : "Dein Tages-Start",
    summary:
      completion >= 67
        ? "Ein letzter Baustein fehlt noch für einen kompletten BodyFuel-Tag."
        : completion >= 34
          ? "Der erste Schritt sitzt. Fuely hält den Rest für dich im Blick."
          : "Starte mit einer kleinen Aktion und bring den Tag ins Rollen.",
    completion,
    signals: [
      { label: "Training", complete: trainedToday },
      { label: "Messung", complete: measuredToday },
      { label: "Tagespunkte", complete: pointsProgress >= 100 },
    ],
  };
}
