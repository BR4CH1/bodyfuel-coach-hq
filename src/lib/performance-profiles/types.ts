// Sport Performance Profile System — generisch, client-safe, deklarativ.

export type PositionGroup = "SKILL" | "HYBRID" | "LINE" | "SPECIALIST";
export type ModuleId = "speed" | "agility" | "power" | "strength";
export type Direction = "higher_is_better" | "lower_is_better";

export interface PerformanceTest {
  id: string;
  name: string;
  moduleId: ModuleId;
  unit: "s" | "cm" | "kg";
  direction: Direction;
  short: string;
  instructions: string[];
  equipment: string[];
  videoRequirements: string[];
  /** Optionale Demo-URL (YouTube), analog zu normalen Trainingsübungen. */
  demoVideoUrl?: string;
  inputs: {
    measurementMethod?: boolean;
    surface?: boolean;
    footwear?: boolean;
    reps?: boolean;
    rir?: boolean;
    bodyweight?: boolean;
  };
  variants?: { id: string; label: string }[];
  /**
   * Per-position-group benchmark anchors.
   * Two values (min, max) for score 0 and 100 respectively (interpolated linearly).
   * For lower_is_better: [worst_time, best_time]; for higher_is_better: [worst_val, best_val].
   */
  benchmarks: Partial<Record<PositionGroup, [number, number]>>;
}

export interface PerformanceModule {
  id: ModuleId;
  name: string;
  tests: PerformanceTest[];
}

export interface PerformanceProfile {
  id: string;
  name: string;
  positions: Record<string, PositionGroup>;
  moduleWeights: Record<PositionGroup, Record<ModuleId, number>>;
  modules: PerformanceModule[];
}

export interface TestResult {
  id: string;
  test_id: string;
  module_id: ModuleId;
  variant?: string | null;
  result_value: number;
  result_unit: string;
  reps?: number | null;
  bodyweight_kg?: number | null;
  rir?: number | null;
  measurement_method?: string | null;
  surface?: string | null;
  footwear?: string | null;
  video_path?: string | null;
  verification_status: "draft" | "submitted" | "verified" | "corrected" | "rejected";
  coach_corrected_value?: number | null;
  coach_note?: string | null;
  rejection_reason?: string | null;
  verified_at?: string | null;
  performed_at: string;
  position_snapshot?: string | null;
}
