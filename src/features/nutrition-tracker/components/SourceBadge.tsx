import type { FoodResult } from "@/lib/nutrition.functions";

export function SourceBadge({
  source,
  verified,
}: {
  source?: FoodResult["source"];
  verified?: boolean;
}) {
  if (verified) {
    return (
      <span className="ml-1 inline-flex items-center rounded-sm bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
        BodyFuel ✓
      </span>
    );
  }

  switch (source) {
    case "bls_4_0":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-emerald-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
          BLS 4.0
        </span>
      );
    case "bodyfuel_verified":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
          BodyFuel ✓
        </span>
      );
    case "open_food_facts":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-sky-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-400">
          OFF
        </span>
      );
    case "usda":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-sky-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-400">
          USDA
        </span>
      );
    case "ai_estimate":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-400">
          ⚠ geschätzt
        </span>
      );
    default:
      return null;
  }
}
