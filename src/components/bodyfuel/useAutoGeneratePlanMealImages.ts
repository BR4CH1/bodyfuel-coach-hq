import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { generateMealImage, type MealImageStatus } from "@/lib/meal-images.functions";

export type PlanMealImageCandidate = {
  id: string;
  image_url?: string | null;
  image_status?: MealImageStatus | null;
};

export function useAutoGeneratePlanMealImages({
  enabled,
  meals,
  onUpdate,
}: {
  enabled: boolean;
  meals: PlanMealImageCandidate[];
  onUpdate: (mealId: string, imageUrl: string | null, status: MealImageStatus) => void;
}) {
  const generateImage = useServerFn(generateMealImage);
  const attemptedIds = useRef(new Set<string>());
  const busy = useRef(false);
  const mounted = useRef(true);
  const onUpdateRef = useRef(onUpdate);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || busy.current) return;

    const meal = meals.find(
      (candidate) =>
        !candidate.image_url &&
        candidate.image_status !== "generating" &&
        !attemptedIds.current.has(candidate.id),
    );
    if (!meal) return;

    attemptedIds.current.add(meal.id);
    busy.current = true;
    onUpdateRef.current(meal.id, null, "generating");

    void generateImage({
      data: { target: "plan_meal", meal_id: meal.id, force: false },
    })
      .then((result) => {
        if (!mounted.current) return;
        const status: MealImageStatus =
          result.status === "generated" ||
          result.status === "cached" ||
          result.status === "preserved"
            ? "ready"
            : result.status === "fallback"
              ? "fallback"
              : "failed";
        onUpdateRef.current(meal.id, result.image_url ?? null, status);
      })
      .catch(() => {
        if (mounted.current) onUpdateRef.current(meal.id, null, "failed");
      })
      .finally(() => {
        busy.current = false;
        if (mounted.current) setRevision((value) => value + 1);
      });
  }, [enabled, generateImage, meals, revision]);
}
