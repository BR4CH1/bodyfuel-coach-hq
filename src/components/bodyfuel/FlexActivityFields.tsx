import {
  ACTIVITY_INTENSITIES,
  ACTIVITY_INTENSITY_LABELS,
  FLEX_SPORTS,
  FLEX_SPORT_LABELS,
  type ActivityIntensity,
  type FlexActivitySport,
} from "@/lib/training-activity-types";
import type { WeeklyTrainingActivity } from "@/lib/training-weekly-activity.functions";

/**
 * Zusatzfelder für Flex-Aktivitäten (Sportart, Dauer, Intensität).
 * Wird in beiden Wochen-Editoren identisch verwendet.
 */
export function FlexActivityFields({
  activity,
  disabled,
  onPatch,
}: {
  activity: WeeklyTrainingActivity;
  disabled?: boolean;
  onPatch: (patch: Partial<WeeklyTrainingActivity>) => void;
}) {
  if (activity.type !== "flex") return null;
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      <label className="min-w-0">
        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Sportart
        </span>
        <select
          disabled={disabled}
          value={activity.sport ?? "sonstige"}
          onChange={(event) => {
            const sport = event.target.value as FlexActivitySport;
            const currentTitle = activity.title?.trim() ?? "";
            const wasAutoTitle =
              !currentTitle ||
              (FLEX_SPORTS as string[]).some(
                (key) => FLEX_SPORT_LABELS[key as FlexActivitySport] === currentTitle,
              );
            onPatch({
              sport,
              ...(wasAutoTitle ? { title: FLEX_SPORT_LABELS[sport] } : {}),
            });
          }}
          className="min-h-[40px] w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-bold outline-none focus:border-primary disabled:opacity-55"
        >
          {FLEX_SPORTS.map((sport) => (
            <option key={sport} value={sport}>
              {FLEX_SPORT_LABELS[sport]}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Dauer (Min)
        </span>
        <input
          type="number"
          min={0}
          max={600}
          step={5}
          inputMode="numeric"
          disabled={disabled}
          value={activity.durationMin ?? ""}
          onChange={(event) =>
            onPatch({ durationMin: event.target.value ? Number(event.target.value) : null })
          }
          placeholder="z. B. 90"
          className="min-h-[40px] w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-bold outline-none focus:border-primary disabled:opacity-55"
        />
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Intensität
        </span>
        <select
          disabled={disabled}
          value={activity.intensity ?? "mittel"}
          onChange={(event) => onPatch({ intensity: event.target.value as ActivityIntensity })}
          className="min-h-[40px] w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-bold outline-none focus:border-primary disabled:opacity-55"
        >
          {ACTIVITY_INTENSITIES.map((intensity) => (
            <option key={intensity} value={intensity}>
              {ACTIVITY_INTENSITY_LABELS[intensity]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
