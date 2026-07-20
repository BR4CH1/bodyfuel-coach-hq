# Sprint 1 – PlanBuilder Refactoring

## Completed

- Extracted the pure nutrition-plan-builder domain logic from `PlanBuilderPage.tsx`.
- Added `src/features/nutrition-plan-builder/lib/plan-builder.logic.ts`.
- Moved date helpers, meal conversion/macros, scoring, auto-fill, partner auto-fill,
  rebalancing, copy remapping, and portion scaling into the feature layer.
- Reduced `PlanBuilderPage.tsx` from 1,901 to 1,543 lines without intentionally
  changing UI behaviour.

## Why this is the first step

The former page combined domain logic, server orchestration, state management and UI.
The extracted functions are now isolated and can be unit-tested without rendering React.

## Next refactoring slice

1. Extract `MealPickerDialog` and `MealSlotRow` into `components/`.
2. Extract `DayCard` and `PartnerDayBlock`.
3. Move page state and save/copy/auto-fill orchestration into `usePlanBuilder`.
4. Add unit tests for scoring, allergy exclusion, auto-fill and partner coupling.

## Slice 2 completed

- Extracted `MealPickerDialog` to `src/features/nutrition-plan-builder/components/MealPickerDialog.tsx`.
- Extracted `MealSlotRow` to `src/features/nutrition-plan-builder/components/MealSlotRow.tsx`.
- Reduced `PlanBuilderPage.tsx` further from 1,543 to 1,300 formatted lines.
- Kept meal scoring, partner coupling, portion controls and picker behavior unchanged.
- Verified both extracted components with ESLint and parsed/bundled the affected TSX files with esbuild.
- Full-project TypeScript checking did not finish within the available timeout; this repository already has a very large type-check surface.

## Next slice

1. Extract `DayCard`.
2. Extract `PartnerDayBlock`.
3. Move builder orchestration and state into `usePlanBuilder`.
4. Add focused unit tests for plan-builder domain logic.

## Slice 3 completed

- Extracted `DayCard` to `src/features/nutrition-plan-builder/components/DayCard.tsx`.
- Extracted `PartnerDayBlock` to `src/features/nutrition-plan-builder/components/PartnerDayBlock.tsx`.
- Reduced `PlanBuilderPage.tsx` from 1,300 to 678 formatted lines.
- Preserved day targets, macro balance display, meal-prep coupling, per-slot editing,
  partner recipe synchronization, pair auto-fill, individual portion scaling and copy actions.
- Verified both extracted components with ESLint.
- Parsed/bundled the page and both new components with esbuild successfully.
- The full Vite production build was attempted twice but did not complete within the available
  timeout because the repository emits a very large number of existing TanStack
  `inputValidator()` deprecation warnings.

## Next slice

1. Move page state, queries and save/copy orchestration into `usePlanBuilder`.
2. Replace the state-building `useMemo` with a proper effect/helper.
3. Remove remaining `any` casts around server-function calls.
4. Add focused unit tests for copy remapping, day auto-fill and partner coupling.

## Slice 4 completed

- Added `src/features/nutrition-plan-builder/hooks/usePlanBuilder.ts`.
- Moved React Query loading, partner-plan state, date-range state, save/publish navigation,
  day copying, paired copying, weekly auto-fill and undo orchestration out of the page.
- Replaced the former state-mutating `useMemo` with a proper `useEffect` plus the pure
  `buildBuilderDays` helper.
- Added `cloneBuilderDays` for safe undo snapshots.
- Removed the remaining `any` casts from the plan-builder save calls and changed error handling
  to use `unknown` safely.
- Fixed the missing `Users` icon import in `PlanBuilderPage.tsx`.
- Reduced `PlanBuilderPage.tsx` from 678 to 416 formatted lines.
- Added four focused Vitest tests covering day construction, deep cloning, copy-group remapping
  and auto-fill behavior with locked meals.

## Slice 4 verification

- Targeted ESLint check: passed with no warnings.
- Focused Vitest run: 4/4 tests passed.
- Targeted TypeScript check for the affected dependency graph: passed.
- TS/TSX parsing with esbuild: passed.
- The full-project `tsc --noEmit` check was attempted, but the repository-wide check did not
  complete within the available timeout.

## Recommended next step

The Plan Builder is now separated into domain logic, reusable components and orchestration.
The next high-leverage refactoring target is `NutritionTracker`, followed by
`coach.teams.$orgId.tsx`.
