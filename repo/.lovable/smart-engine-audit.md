# Smart-Engine Reuse Audit

> Generated from codebase analysis. File references are project-root-relative.

---

## 1. Smart Nutrition Stack

### Routes

| Route file | Path pattern | Notes |
|---|---|---|
| `src/routes/nutrition.tsx` | `/nutrition` | Shell layout (Outlet only) |
| `src/routes/nutrition.index.tsx` | `/nutrition/` | Full Smart Nutrition hub |
| `src/routes/nutrition.tracking.tsx` | `/nutrition/tracking` | Barcode + food tracker |
| `src/routes/nutrition.favorites.tsx` | `/nutrition/favorites` | Saved recipes |
| `src/routes/nutrition.shopping.tsx` | `/nutrition/shopping` | Auto shopping list |
| `src/routes/nutrition.recipe-from-ingredients.tsx` | `/nutrition/recipe-from-ingredients` | AI recipe builder |
| `src/routes/tracker.app.nutrition.tsx` | `/tracker/app/nutrition` | Free-tier wrapper around `NutritionTracker` |
| `src/routes/onboarding.smart-nutrition.tsx` | `/onboarding/smart-nutrition` | Multi-step profile wizard |
| `src/routes/mein-bodyfuel.tsx` | `/mein-bodyfuel` | Personal hub landing |
| `src/routes/$orgSlug.nutrition.tsx` | `/:orgSlug/nutrition` | Org-athlete nutrition (reuses same Smart components) |

### Main components used in the nutrition stack

- `NutritionTracker` (`src/components/bodyfuel/NutritionTracker.tsx`) – food search, barcode scanner, macro ring, daily log CRUD
- `MealSwapDialog` (`src/components/bodyfuel/MealSwapDialog.tsx`) – AI meal swap within plan
- `MacroTargetsCard` (`src/components/bodyfuel/MacroTargetsCard.tsx`) – displays coach-set targets
- `DailyMacroSummary` (`src/components/bodyfuel/DailyMacroSummary.tsx`) – compact daily summary card
- `PlanContentView` (`src/components/bodyfuel/PlanContentView.tsx`) – renders nutrition (and training) plan days/meals; the heaviest component in the stack; writes `food_entries`
- `WeekScheduleCard` (`src/components/bodyfuel/WeekScheduleCard.tsx`) – training/rest day schedule
- `PlateauWarning` (`src/components/bodyfuel/PlateauWarning.tsx`) – stall detection
- `DietPreferencesCard` (`src/components/bodyfuel/DietPreferencesCard.tsx`) – inline profile editing
- `MealWishesCard` (`src/components/bodyfuel/MealWishesCard.tsx`) – wish list for next plan
- `CustomMealsCard` (`src/components/bodyfuel/CustomMealsCard.tsx`) – personal food overrides
- `PlansView` (`src/components/bodyfuel/PlansView.tsx`) – coach list-of-clients plan picker
- `TrialNutritionPlan` (from `src/components/bodyfuel/TrialPlanView.tsx`) – reduced trial experience

### Hardcoded color references vs design tokens

All "gold" references use the CSS custom property `--gold: oklch(0.72 0.18 148)` defined in `src/styles.css:64` and surfaced as Tailwind utility classes (`text-gold`, `border-gold`, `bg-gradient-gold`) via `@utility` blocks at `src/styles.css:101-116`. These are **design tokens**, not hex literals.

However, several amber/emerald values are **hardcoded Tailwind palette classes** that do **not** use tokens:

- `src/routes/nutrition.index.tsx:84` — `border-amber-500/60`, `from-amber-500/15`, `text-amber-500` (training-days CTA)
- `src/routes/$orgSlug.nutrition.tsx:83-121` — same amber literals duplicated verbatim
- `src/components/bodyfuel/PlanContentView.tsx:698,703,708,786` — `text-emerald-400`, `bg-emerald-500/15`, `border-emerald-500/40` (verified-meal badges)

The `bg-gradient-gold` and `text-gold` tokens appear pervasively (50+ usages) across `NutritionTracker`, `PlanContentView`, `MacroTargetsCard`, `DailyMacroSummary`, `MealSwapDialog`. These will render incorrectly in a Bulls context where the accent is `--bulls-red` unless a CSS-variable override layer is applied.

---

## 2. Smart Nutrition Server Functions

### `src/lib/nutrition.functions.ts`

| fn | Tables read | Tables written | Entitlement guard |
|---|---|---|---|
| `lookupBarcode` | OpenFoodFacts (external) | — | None (public) |
| `searchFoods` | `nutrition_foods` | — | None (public) |
| `setNutritionTargets` | — | `nutrition_targets` | `assertCoachOrOrgStaffForAthlete` (coach OR org staff for that athlete) |
| `getNutritionTargets` | `nutrition_targets` | — | `assertCoachOrOrgStaffForAthlete` |

### `src/lib/nutrition-plan.functions.ts`

| fn | Tables read | Tables written | Entitlement guard |
|---|---|---|---|
| `parseNutritionPlan` | (parses uploaded file) | `nutrition_plans`, `nutrition_plan_days`, `nutrition_plan_meals` | `has_role('coach')` only |
| `estimateMealMacros` | `nutrition_foods` | — | `has_role('coach')` only |
| `getMealMacroDebug` | `nutrition_plan_meals`, `nutrition_foods` | — | `has_role('coach')` only |
| `generateMealRecipe` | `nutrition_plan_meals` | `nutrition_plan_meals` | `has_role('coach')` only |

> ⚠️ These four fns use `supabase.rpc("has_role", { _role: "coach" })` and **do not** fall back to `assertCoachOrOrgStaffForAthlete`. Org nutrition coaches cannot call them.

### `src/lib/plan-builder.functions.ts`

| fn | Tables read | Tables written | Entitlement guard |
|---|---|---|---|
| `listMealLibrary` | `coach_meal_library` | — | `assertGlobalCoachOrAnyOrgCoach` ✓ |
| `getCustomerPlanContext` | `smart_nutrition_profile`, `nutrition_targets` | — | `assertCoachOrOrgStaffForAthlete` ✓ |
| `saveBuilderPlan` | (delegates to `saveCoachNutritionPlanDraft`) | `nutrition_plans`, `nutrition_plan_days`, `nutrition_plan_meals` | `assertCoachOrOrgStaffForAthlete` ✓ |
| `saveBuilderPartnerPlan` | — | same as above × 2 | `assertCoachOrOrgStaffForAthlete` × 2 ✓ |

### `src/lib/nutrition-plan-ai.functions.ts`

| fn | Tables read | Tables written | Entitlement guard |
|---|---|---|---|
| `generateAiNutritionPlanDraft` | `smart_nutrition_profile`, `nutrition_targets`, `coach_meal_library` | `nutrition_plans`, `nutrition_plan_days`, `nutrition_plan_meals` | `assertCoachOrOrgStaffForAthlete` if `target !== userId` ✓ |

### `src/lib/smart-profile.functions.ts`

| fn | Tables read | Tables written | Entitlement guard |
|---|---|---|---|
| `getMySmartProfile` | `smart_nutrition_profile` | — | Any authenticated user (self-read) ✓ |
| `saveSmartProfile` | — | `smart_nutrition_profile` | Any authenticated user (self-write) ✓ |
| `getCustomerSmartProfile` | `smart_nutrition_profile` | — | Self or `assertCoachOrOrgStaffForAthlete` ✓ |
| `setCustomerWeeklyBudget` | `nutrition_partners` | `smart_nutrition_profile` | `assertCoachOrOrgStaffForAthlete` ✓ |

---

## 3. Smart Training Stack

### Routes

| Route file | Path pattern |
|---|---|
| `src/routes/training.tsx` | `/training` — Smart training hub for personal BF users |
| `src/routes/tracker.app.training.tsx` | `/tracker/app/training` — Free-tier read-only training view |
| `src/routes/$orgSlug.training.tsx` | `/:orgSlug/training` — Org athlete training page |
| `src/routes/$orgSlug.athletic.$sessionId.tsx` | `/:orgSlug/athletic/:sessionId` — Org athletic session detail |

`/training` uses: `PlansView`, `TrainingTracker`, `PlanContentView` (with `planType="training"`), `StrengthCheckStatus`, `StrengthSummaryCard`, `AthleteProfileBanner`, `TrialTrainingPlan`.

`/$orgSlug/training` uses: `getOrgAthleticTraining` server fn (reads `organization_athletic_plans`, `organization_tasks`, `organization_team_training_schedule` via task-engine). Renders inline JSX — no reusable training components from `src/components/bodyfuel/`.

### `src/lib/training-plan-builder.functions.ts`

| fn | Tables read | Tables written | Guard |
|---|---|---|---|
| `listExerciseLibrary` | `coach_exercise_library` | — | `assertGlobalCoachOrAnyOrgCoach` ✓ |
| `getCustomerTrainingContext` | `profiles`, `smart_nutrition_profile`, `body_measurements`, `strength_checks`, `nutrition_partners` | — | `assertCoachOrOrgStaffForAthlete` ✓ |
| `saveBuilderTrainingPlan` | — | `nutrition_plans` (plan_type='training'), `training_days`, `training_exercises` | `assertCoachOrOrgStaffForAthlete` ✓ |

> Note: training plans are stored in the `nutrition_plans` table with `plan_type = 'training'` and rendered by the same `PlanContentView` component.

### `src/lib/training-plan-ai.functions.ts`

| fn | Tables read | Tables written | Guard |
|---|---|---|---|
| `generateAiTrainingPlanDraft` | `smart_nutrition_profile`, `body_measurements`, `strength_checks`, `coach_exercise_library` | `nutrition_plans`, `training_days`, `training_exercises` | `assertCoachOrOrgStaffForAthlete` ✓ |

### `src/lib/training-plan-management.functions.ts`

| fn | Tables read | Tables written | Guard |
|---|---|---|---|
| `getCustomerTrainingPlanOverview` | `nutrition_plans`, `training_days` | — | `assertCoachOrOrgStaffForAthlete` ✓ |
| `transitionTrainingPlanStatus` | `nutrition_plans` | `nutrition_plans` | `assertCoachOrOrgStaffForAthlete` ✓ |
| `deleteTrainingPlanDraft` | `nutrition_plans` | `nutrition_plans` | `assertCoachOrOrgStaffForAthlete` ✓ |
| `updateTrainingPlanScheduling` | `nutrition_plans` | `nutrition_plans` | `assertCoachOrOrgStaffForAthlete` ✓ |
| `setAutoPublishTraining` | `nutrition_plans` | `nutrition_plans` | `assertCoachOrOrgStaffForAthlete` ✓ |

---

## 4. One-Click Tracking / `food_entries` Writes

All `food_entries` **inserts** (creating new entries):

| Location | How invoked | User context |
|---|---|---|
| `src/components/bodyfuel/NutritionTracker.tsx:589` | `supabase.from("food_entries").insert(...)` | Self, via Supabase client |
| `src/components/bodyfuel/NutritionTracker.tsx:706` | same, for meal quick-log | Self |
| `src/components/bodyfuel/PlanContentView.tsx:493` | same, one-click "mark eaten" | Self |
| `src/components/bodyfuel/PlanContentView.tsx:527` | same, after swap confirmed | Self |
| `src/components/bodyfuel/MealSwapDialog.tsx:92` | same, swap write | Self |
| `src/components/bodyfuel/TrialPlanView.tsx:254` | same, trial quick-track | Self |
| `src/routes/nutrition.recipe-from-ingredients.tsx:154` | same, recipe-result track | Self |
| `src/lib/custom-meals.functions.ts:141` | server fn (coach or self) | Self or coach |

**Deletes** are in `NutritionTracker.tsx:723` and `PlanContentView.tsx:451`.

> There is **no single source-of-truth** write fn. Inserts are scattered across 7 distinct UI locations using direct Supabase client calls. This means RLS is the only enforcement layer. A future "org member tracking" feature would need either (a) a dedicated `createServerFn` wrapper or (b) careful RLS policy extension.

---

## 5. Entitlement Guards

### Client-side (UI gating)

| Check | Location | What it gates |
|---|---|---|
| `pkg.package === "smart"` check via `customer_packages` | `src/components/bodyfuel/AppLayout.tsx:177` | Hard-gate redirect to `/onboarding/smart` if Smart + not onboarded |
| `isFreeUser && !freeBullsAccess` | `AppLayout.tsx:208` | Blocks free users from `AppLayout`-wrapped routes entirely |
| `entitlements.hasAnyPersonalBodyfuel` | `AppLayout.tsx:~148` | Staff-only users redirected to coach cockpit |
| `isTeamOnlyUser` | `AppLayout.tsx:~152` | Org-only athletes redirected to `/$orgSlug` |
| `hasGroup("bulls")` | `BullsGate.tsx:13-18` | Redirects non-Bulls users away from `/bulls/*` |
| `useEntitlements().hasBodyfuelSmart` | `src/lib/bodyfuel/entitlements.ts:104` | Computed from `customer_packages.package = 'smart'` |
| `useTrial()` → `isTrial` / `isExpired` | `src/routes/nutrition.index.tsx`, `training.tsx` | Switches to `TrialNutritionPlan` / `TrialTrainingPlan` |

### Server-side (fn guards)

| Guard function | Used by | Meaning |
|---|---|---|
| `assertCoachOrOrgStaffForAthlete` (`src/lib/organizations/org-coach-access.ts`) | Most plan/target/profile fns | Global coach OR org staff with correct permission key (`manage_nutrition` / `manage_training`) |
| `assertGlobalCoachOrAnyOrgCoach` | `listMealLibrary`, `listExerciseLibrary` | Global coach OR any staff_assignment with `role='coach'` |
| `has_role('coach')` (RPC) | `parseNutritionPlan`, `estimateMealMacros`, `getMealMacroDebug`, `generateMealRecipe` (in `nutrition-plan.functions.ts`) | **Global platform coach only** — org nutrition coaches excluded |
| `assertBulls` (inline in `bulls.functions.ts`) | All `bulls.*` fns | `has_group('bulls')` RPC |

---

## 6. Organization Mini-Plans

### Tables

| Table | Purpose |
|---|---|
| `athlete_nutrition_schedule` | Per-athlete nutrition plan assignment |
| `org_group_nutrition_schedule` | Group-level nutrition plan |
| `org_team_nutrition_schedule` | Team-level nutrition plan |
| `athlete_training_schedule` | Per-athlete training schedule |
| `org_group_training_schedule` | Group-level training schedule |
| `organization_team_training_schedule` | Team-level recurring training events |

### Where code touches these tables

All reads/writes are in **server functions only**:

- `src/lib/organizations/roster-schedule.functions.ts:128-362` — all six tables; CRUD for coach roster management
- `src/lib/organizations/task-engine.functions.ts:181,199` — reads `organization_team_training_schedule` to generate `organization_tasks`
- `src/lib/organizations/task-engine.server.ts:65,72,75` — reads all schedule tables to build daily task queue

### UI that renders them today

**No direct route renders these tables.** They feed into `organization_tasks` via the task-engine, which is then surfaced in `src/routes/$orgSlug.training.tsx` via `getOrgAthleticTraining` (`src/lib/organizations/athlete.functions.ts`). The player view shows the resulting tasks as inline JSX tiles — there is no reusable component.

The `bulls.nutrition.tsx` and `bulls.training.tsx` routes render **hardcoded static mini-plans** (not from any schedule table) — they are pure prose HTML, gated by `BullsGate`.

### What breaks when Smart modules replace the player view

The `$orgSlug.training.tsx` page renders `organization_tasks` produced by the task engine (which fuses `organization_team_training_schedule` + `organization_athletic_plans`). If replaced by the Smart `PlanContentView`, the task-engine feed would have no renderer — the data would still be generated but never displayed. The static mini-plan cards in `$orgSlug.training.tsx` would also be lost. No shared component currently bridges the two.

---

## 7. Coach-Assigned Athletic Plans

### Tables

| Table | Notes |
|---|---|
| `organization_athletic_plan_assignments` | Links a plan to a team/athlete |
| `organization_athletic_plan_sessions` | Individual sessions within a plan |
| `organization_athletic_plan_exercises` | Exercises within a session |
| (completions stored in `organization_tasks` via `source_type = 'athletic_plan_session'`) | |

### Which components/routes read them

- `src/lib/organizations/task-engine.server.ts:72-75` — reads `organization_athletic_plan_sessions` + `organization_athletic_plan_assignments` to build tasks
- `src/lib/organizations/operating-loop.functions.ts:404-450` — `getOrgAthleticSession` reads sessions + exercises; `completeOrgAthleticSession` marks completion in `organization_tasks`
- `src/routes/$orgSlug.athletic.$sessionId.tsx` — the only UI consumer; renders session detail via `getOrgAthleticSession`
- `src/routes/$orgSlug.training.tsx` — reads the resulting active plan name via `getOrgAthleticTraining` (queries `organization_athletic_plans` for the current user's active plan)

**These stay as the COACH training source.** The session detail route (`$orgSlug.athletic.$sessionId.tsx`) is the dedicated UI for coach-assigned athletic work and should not be replaced.

---

## 8. Team Training Events

### Tables touched

| Table | Where |
|---|---|
| `bulls_hub_events` | `src/lib/bulls.functions.ts` — `upsertBullsProfile`, `trackHubEvent`, `getStarterScore`; `src/routes/bulls.nutrition.tsx`, `bulls.training.tsx` (via `trackHubEvent`) |
| `organization_teams` | `src/components/bodyfuel/AppLayout.tsx:~140` — sidebar team count query; `src/lib/organizations/org-coach-access.ts` — team membership lookup |
| `organization_team_training_schedule` | `src/lib/organizations/task-engine.functions.ts:181,199`; `src/lib/organizations/task-engine.server.ts:65` |

### Which files render them

- `bulls_hub_events`: No direct render. Used to compute `StarterScore` shown in `src/routes/bulls.tsx` (index). Events are write-only from the UI.
- `organization_team_training_schedule`: Indirectly rendered in `src/routes/$orgSlug.training.tsx` via task-engine → `organization_tasks`.
- `organization_teams`: Count shown in AppLayout sidebar (`src/components/bodyfuel/AppLayout.tsx:~140`); structural data used in access-control logic.

---

## 9. Bulls Branding

### Token definitions (`src/styles.css`)

```css
/* Lines 118–136 */
--bulls-red: oklch(0.62 0.22 25);
--bulls-red-bright: oklch(0.68 0.24 25);
--bulls-black: oklch(0.10 0.005 250);

@utility bg-bulls-red { background-color: var(--bulls-red); }
@utility text-bulls-red { color: var(--bulls-red); }
@utility border-bulls-red { border-color: var(--bulls-red); }
@utility bg-gradient-bulls { background: linear-gradient(135deg, var(--bulls-red-bright) 0%, var(--bulls-red) 100%); }
@utility shadow-bulls { box-shadow: 0 10px 30px -10px var(--bulls-red); }
```

Gold tokens (`--gold`, `--gold-soft`, `bg-gradient-gold`, `shadow-gold`) at `src/styles.css:64-116`.

### How theming is applied today

1. **`BullsGate.tsx:22`** wraps all Bulls content in `<div className="bulls-theme">`. This class name is defined but there is currently **no CSS rule for `.bulls-theme { ... }`** in `src/styles.css` — it is a placeholder with no variable overrides yet.
2. **`BullsHero.tsx`** uses Tailwind utility classes: `border-bulls-red/40`, `text-bulls-red`, `shadow-bulls`. These reference the CSS custom properties above.
3. **`AppLayout.tsx`** has no Bulls-specific theming — `text-gold` and `bg-gradient-gold` are used throughout the sidebar regardless of context.
4. **`$orgSlug.nutrition.tsx:53`** applies `style={{ background: \`linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)\` }}` — inline style with `org.primary_color` from DB. This is the current org-theming mechanism for headers only.

### Where a `theme-bulls` CSS-variable layer would plug in

The `BullsGate.tsx` wrapper div already uses `className="bulls-theme"`. Adding a CSS layer:

```css
/* src/styles.css — add after existing :root block */
.bulls-theme {
  --gold: var(--bulls-red);
  --gold-soft: var(--bulls-red-bright);
}
```

would remap all `text-gold`, `border-gold`, `bg-gradient-gold` etc. to Bulls-red inside the gate — without changing any component code. The same pattern would work for other orgs via `.theme-{orgSlug}` classes applied at the `OrgAthleteLayout` level.

---

## 10. Hub Selector / Experience Switch

### `src/components/organizations/OrganizationContextSwitcher.tsx`

**Data source**: `getMyOrgContexts` server fn — returns all orgs where the user is an `organization_membership` athlete or `staff_assignment` staff.

**State storage**: `localStorage` keys:
- `bodyfuel.activeContext` → current org slug (or null for personal)
- `bodyfuel.orgMode:{slug}` → `"athlete"` or `"staff"` per org

**Navigation logic** (`goOrg` fn, line ~75):
- Staff-only → `/coach/teams/$orgId`
- Athlete (or dual → athlete mode) → `/$orgSlug/home`
- Personal → `/dashboard`

**Dual-role support**: If a user has both `athlete` membership and `staff` assignment in the same org, the switcher shows two sub-buttons ("Athletenbereich" / "Staffbereich") that toggle `orgMode`.

**Context switching today** (personal BodyFuel + Bulls membership):
1. User with both `customer_packages.package = 'smart'` and `user_groups.group_name = 'bulls'` sees the switcher (if they also have `organization_memberships` for a Bulls org).
2. Bulls hub is also directly accessible at `/bulls` (separate from the org-slug flow) and gated by `hasGroup("bulls")` in `BullsGate`.
3. The `AppLayout` sidebar shows a "Bulls Hub" nav item (`bullsNavItem`, line 43) when `hasGroup("bulls")` is true — this is independent of the context switcher.
4. **Gap**: There is no switcher entry for the `/bulls` route — it is a group-based gate, not an org-slug context. A user with personal BodyFuel + Bulls membership must manually navigate to `/bulls`; the switcher only covers org-slug contexts.

**Consumers of `OrganizationContextSwitcher`**:
- `src/components/bodyfuel/AppLayout.tsx` (imported at line ~22, rendered in sidebar)

---

## Summary Tables

### (A) Components that can be reused as-is

| Component | Location | Reason |
|---|---|---|
| `NutritionTracker` | `src/components/bodyfuel/NutritionTracker.tsx` | Self-contained; uses `userId` prop; no org-specific logic |
| `MacroTargetsCard` | `src/components/bodyfuel/MacroTargetsCard.tsx` | Prop-driven (`userId`) |
| `DailyMacroSummary` | `src/components/bodyfuel/DailyMacroSummary.tsx` | Reads `food_entries` by userId |
| `MealWishesCard` | `src/components/bodyfuel/MealWishesCard.tsx` | userId + mode prop |
| `CustomMealsCard` | `src/components/bodyfuel/CustomMealsCard.tsx` | userId prop |
| `WeekScheduleCard` | `src/components/bodyfuel/WeekScheduleCard.tsx` | userId prop |
| `PlateauWarning` | `src/components/bodyfuel/PlateauWarning.tsx` | userId prop |
| `StrengthCheckStatus` | `src/components/bodyfuel/StrengthCheckStatus.tsx` | No theming |
| `StrengthSummaryCard` | `src/components/bodyfuel/StrengthSummaryCard.tsx` | No theming |
| `TrainingTracker` | `src/components/bodyfuel/TrainingTracker.tsx` | userId-based |
| `OrganizationContextSwitcher` | `src/components/organizations/OrganizationContextSwitcher.tsx` | Theme-agnostic |

### (B) Components that must be made context/theme-aware

| Component | Location | Issue |
|---|---|---|
| `PlanContentView` | `src/components/bodyfuel/PlanContentView.tsx` | Heavy use of `text-gold`, `border-gold`, `bg-gradient-gold`, hardcoded emerald badges |
| `MealSwapDialog` | `src/components/bodyfuel/MealSwapDialog.tsx` | `text-gold`, `border-gold/40`, `bg-gradient-gold` |
| `AppLayout` | `src/components/bodyfuel/AppLayout.tsx` | Sidebar uses `text-gold`, `bg-gradient-gold`; Bulls nav item is hard-wired |
| `MacroTargetsCard` | `src/components/bodyfuel/MacroTargetsCard.tsx` | `border-gold/50`, `bg-gradient-gold` accent |
| `DailyMacroSummary` | `src/components/bodyfuel/DailyMacroSummary.tsx` | `text-gold`, `hover:border-gold/50` |
| `NutritionTracker` | `src/components/bodyfuel/NutritionTracker.tsx` | 15+ `text-gold`/`bg-gradient-gold`/`border-gold` usages; macro ring uses `var(--gold)` |
| `BullsHero` | `src/components/bodyfuel/BullsHero.tsx` | Bulls-specific: fine for Bulls, not reusable for other orgs |
| `BullsGate` | `src/components/bodyfuel/BullsGate.tsx` | Bulls-group-specific; needs generalisation to `OrgGate` or `hasGroup(groupName)` |
| `OrgAthleteLayout` | `src/components/organizations/OrgAthleteLayout.tsx` | Receives `primaryColor` prop but applies only to header gradients via inline `style={}` |

### (C) Server fns whose entitlement guard must be widened to accept org membership

| fn | File | Current guard | Required change |
|---|---|---|---|
| `parseNutritionPlan` | `src/lib/nutrition-plan.functions.ts:22` | `has_role('coach')` only | Replace with `assertCoachOrOrgStaffForAthlete` |
| `estimateMealMacros` | `src/lib/nutrition-plan.functions.ts:188` | `has_role('coach')` only | Same |
| `getMealMacroDebug` | `src/lib/nutrition-plan.functions.ts:257` | `has_role('coach')` only | Same |
| `generateMealRecipe` | `src/lib/nutrition-plan.functions.ts:338` | `has_role('coach')` only | Same |

### (D) Mini-plan UI to remove from the player view

| File | What to remove | Replace with |
|---|---|---|
| `src/routes/bulls.nutrition.tsx` | Entire hardcoded prose mini-plan (`Day`/`Meal` components) | `PlanContentView` or `NutritionTracker` from Smart stack |
| `src/routes/bulls.training.tsx` | Entire goal-keyed hardcoded plan (`Plan`/`Block` components) | `PlanContentView` (planType='training') from Smart stack |
| `src/routes/$orgSlug.training.tsx` (inline task tiles) | Inline task-list JSX (no shared component) | Merge with Smart `TrainingTracker` / `PlanContentView`; keep `getOrgAthleticTraining` as data source |

### (E) Files that hardcode BodyFuel/gold colors and need token migration

| File | Hardcoded values | Token to introduce |
|---|---|---|
| `src/routes/nutrition.index.tsx:84` | `border-amber-500/60`, `from-amber-500/15`, `text-amber-500` | `border-accent-2`, `text-accent-2` or keep as semantic warning color |
| `src/routes/$orgSlug.nutrition.tsx:70-121` | Same amber literals (copy-paste of above) | Same as above |
| `src/components/bodyfuel/PlanContentView.tsx:698,703,708,786` | `text-emerald-400`, `bg-emerald-500/15`, `border-emerald-500/40` | `text-verified`, `bg-verified` semantic token |
| `src/components/bodyfuel/NutritionTracker.tsx` | `color: "var(--gold)"` inline at macro ring (line 862) + 15 Tailwind `text-gold`/`border-gold` classes | Already using CSS var; needs `.bulls-theme { --gold: var(--bulls-red) }` override (see §9) |
| `src/components/bodyfuel/MealSwapDialog.tsx:160,168,201` | `border-gold/40`, `bg-gold/10`, `text-gold`, `bg-gradient-gold` | Same override approach |
| `src/components/bodyfuel/MacroTargetsCard.tsx:82,90` | `border-gold/50`, `bg-gradient-gold` | Same override approach |
| `src/components/bodyfuel/DailyMacroSummary.tsx:82,83` | `text-gold`, `hover:border-gold/50` | Same override approach |
| `src/routes/$orgSlug.nutrition.tsx:53` | `org.primary_color ?? "#000"` inline style | Already org-aware; acceptable for header gradient |
