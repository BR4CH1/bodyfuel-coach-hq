# BodyFuel Performance Engine V1 — Foundation

Generic, multi-sport performance system. Bulls (American Football) is the first real configuration; Rot-Weiss Essen (Football/Soccer) or any other sport can reuse the same engine with different test batteries, position profiles and metric weights.

Personal BodyFuel Strength Score V2 remains untouched.

---

## 0. Dual-Role First-Use Fix

`src/routes/$orgSlug.index.tsx` — when a user has BOTH athlete membership AND staff assignment in the same organisation AND no persisted `bodyfuel.orgMode:<slug>`, we now show a one-time prompt:

> **Wie möchtest du [ORG] öffnen?** — Athletenbereich / Staffbereich

Choice persists via `setOrgMode`. Subsequent visits use the persisted value; the existing context switcher still lets users flip modes.

---

## 1. Tables created (migration `2026-07-06`)

All tables are `organization_id`-scoped where applicable, RLS-enabled, and granted to `authenticated` + `service_role`.

| Table | Purpose |
|---|---|
| `performance_frameworks` | Sport-specific framework (template or org-owned), with `sport`, `version`, `status`, `is_template`, `parent_framework_id` |
| `performance_domains` | Framework's domain list (acceleration, speed …) with `key`, `order_index`, `active` |
| `performance_test_batteries` | Named collections of tests per framework, versioned |
| `performance_test_definitions` | Single test (10 m Sprint, CMJ …) with `unit`, `value_type`, `direction`, `decimal_places`, `result_selection`, `protocol` (jsonb) |
| `performance_metric_definitions` | `raw_test` or `derived` metrics with `calculation_type` (allowlist), `config` |
| `performance_domain_metric_weights` | Contribution of a metric to a domain score |
| `performance_position_profiles` | `QB`, `RB` … or `GK`, `CB` … with `age_group`, `status` |
| `performance_position_domain_weights` | Domain weight per position profile |
| `performance_benchmark_models` | `fixed_thresholds`, `organization_internal`, `team_internal`, `age_group_internal`, `position_internal`, `external_reference`, `longitudinal_self_comparison` with `minimum_sample_size`, `source_reference` |
| `performance_test_sessions` | Planned/completed sessions with `test_date`, `status`, `team_id` |
| `performance_test_session_athletes` | Session roster |
| `performance_test_attempts` | Raw attempts (never overwritten by scoring) with `raw_value`, `unit_snapshot`, `valid`, `invalid_reason`, `measured_at`, `metadata` |
| `performance_session_context_snapshots` | Bodyweight etc. captured at test time — never mutated by later profile edits |
| `performance_athlete_profiles` | Computed profile with `overall_score`, `confidence`, `data_coverage`, `framework_version`, `calculation_version` |
| `performance_athlete_metric_scores` | Per-metric score with `benchmark_model_id`, `benchmark_version`, `comparison_group`, `sample_size` |
| `performance_athlete_domain_scores` | Per-domain score with `contributing_metrics` breakdown |
| `performance_athlete_focus_areas` | Development focus with `source` (`engine`/`coach`), `priority`, `status` |
| `performance_retest_schedule` | Per athlete/test `next_retest_due` |

### Staff permissions

New string permissions expected on `staff_assignments.permissions` (text[]):
- `view_performance` — read athlete performance data in scope
- `manage_performance` — create/edit sessions, attempts, and framework configuration

No enum change needed; existing `permissions` column already accepts free-form strings.

---

## 2. Framework versioning

- Frameworks carry `version` and `status` (`draft` / `active` / `archived`).
- A completed test session references `battery_id` (immutable once used), and computed profiles snapshot `framework_version` + `calculation_version`. Structural changes to a framework must be applied as a new version (client policy — enforced in the upcoming Framework Builder UI).
- `parent_framework_id` lets an organisation clone a BodyFuel template without mutating the source.

## 3. Raw attempts stay immutable

- Attempts are inserted via `performance_test_attempts` and only edited by staff with `manage_performance` (or org admin / super admin) to flag `valid=false` with a reason.
- Score recompute NEVER writes back to `performance_test_attempts` — only to `performance_athlete_*` tables.

## 4. Result selection (planned engine helper)

The selected raw value per (athlete, test, session) is a pure function of the test's `result_selection` (`best` / `average` / `median` / `last` / `custom`) applied to `valid=true` attempts. This will live in a single server helper (`src/lib/performance/result-selection.ts`, to be added) — never duplicated in UI.

## 5. Derived metric calculation types

Only an allowlist is honoured (no `eval`, no free-form JS in `config`):
- `direct` — pass-through of a `raw_test` metric
- `ratio` — a / b
- `percentage_difference` — used for left/right asymmetry
- `asymmetry` — abs(l−r) / max(l,r)
- `bodyweight_relative` — value / context bodyweight snapshot
- `formula` — reserved for a future controlled DSL; disabled at engine level until whitelisted

## 6. Internal benchmarks with minimum sample size

Benchmark models declare `minimum_sample_size`. When the filtered comparison group (org / team / age_group / position, per model config) has fewer valid selected results than that, the engine writes `sample_size` but **no numeric score** — the UI shows `BASELINE` / `INSUFFICIENT DATA` rather than a fabricated percentile.

## 7. Direction-aware longitudinal change

A single helper computes improvement %:
- `higher_is_better`: improvement = (new − prev) / prev
- `lower_is_better`: improvement = (prev − new) / prev
- `target_range`: proximity to configured range

This will be centralised in `src/lib/performance/change.ts` and consumed by both athlete profile and coach detail views.

## 8. Position profiles & domain weights

Per framework, editable via `performance_position_profiles` + `performance_position_domain_weights`. Framework Builder will validate the sum ≈ 100 and warn otherwise. Bulls position keys (`QB, RB, WR, TE, OL, DL, LB, DB`) will be inserted as `status='draft'` in the follow-up Bulls seed migration (see section 18).

## 9. 0–100 performance score

Computed by the (upcoming) score engine, roughly:
1. For each active metric with a benchmark model + sufficient sample, map selected value → 0–100 (direction-aware).
2. Domain score = weighted mean of contributing metric scores using `performance_domain_metric_weights`.
3. Overall score = weighted mean of domain scores using the athlete's position profile weights.

Score range is a **presentation scale** only — copy in the UI never claims "74 % Leistungsfähigkeit".

## 10. Confidence & data coverage

- `data_coverage` = present required metrics / total required metrics for the framework.
- `confidence`:
  - `HIGH` — coverage ≥ 80 %, recent test within retest window, sample ≥ 2× minimum
  - `MEDIUM` — coverage ≥ 60 % OR sample near minimum
  - `LOW` — anything else

Written into `performance_athlete_profiles` on each recompute.

## 11. Development focus derivation

Rule-based (no black-box AI). Input: domain scores, position domain weights, longitudinal trend, missing metrics, confidence. Output: prioritized `performance_athlete_focus_areas` rows with `source='engine'`. Coach may add/edit/reorder — those rows land with `source='coach'`.

## 12. Coach overrides

`performance_athlete_focus_areas.source` distinguishes engine vs. coach entries; `status` is `suggested` / `confirmed` / `dismissed`. Recompute never deletes coach rows.

## 13. Athletic plan connection

No auto-assignment. Coach detail view will surface focus areas next to a "Athletikplan zuweisen" action that filters the existing `organization_athletic_plans` by matching focus tags. Feature flag `auto_create_retest_tasks` on `organization_features` defaults to false (to be added in follow-up).

## 14. Retest due

Set on session completion:
- `last_tested_at` = session date
- `next_retest_due` = `last_tested_at + recommended_retest_days` (from test definition, else from battery)

Coach dashboard will surface `WHERE next_retest_due <= today + 14 days`.

## 15. Athlete performance profile UI

Route to add: `/$orgSlug/performance` (gated by feature `performance`). Dynamic — reads active domains from the athlete's profile framework; radar chart renders whatever domains exist. Empty state when no completed session yet.

## 16. Team matrix

Coach path: `coach/teams/$orgId → Performance` tab. Rows = athletes, columns = active domains (dynamic), filters by team / position / confidence / retest due.

## 17. Session & attempt entry

Follow-up UI on `coach/teams/$orgId/performance`:
- Wizard: battery → athletes → date → session name → context snapshots → start
- During session: athlete + test picker, attempt list, invalid-mark, live "selected result"
- On completion: finalize selected results → compute metric/domain/overall scores → write focus areas → update retest schedule → write activity log

## 18. Bulls initial configuration (planned as follow-up seed)

Framework draft: **BodyFuel American Football Performance V1**
- Sport: `american_football`
- Status: `draft`
- Domains: Acceleration, Speed, Explosiveness, Change of Direction, Strength, Conditioning, Robustness
- Position profile drafts: QB, RB, WR, TE, OL, DL, LB, DB (no weights yet)
- Benchmark model: `organization_internal` + `longitudinal_self_comparison`

**Not yet inserted** — Framework Builder UI must land first so the Bulls test battery, metric weights, position domain weights and benchmark thresholds can be entered as reviewed data rather than fabricated numbers.

## 19. Open Bulls sport-specific items (require coach input, not to be invented)

- Final Bulls test battery (which tests, protocols, retest cadences)
- Metric-to-domain weightings per Bulls framework
- Position-domain weightings per Bulls position
- Whether benchmarks stay organization-internal only or ever pull external reference data with cited source

## 20. Ready for football/soccer organisations?

Yes — technically:
- `performance_position_profiles.age_group` supports U19/U17/senior scoping
- Framework, position profiles and benchmark models can all be organisation-scoped via `organization_id`
- Position keys are free-form (GK, CB, FB/WB, DM, CM, AM, W, ST) — no hardcoded American-football assumption
- No RWE data is created automatically

---

## Data separation

- `performance_athlete_*` rows are `organization_id`-scoped; RLS restricts athletes to their own rows.
- Staff need `view_performance` or `manage_performance` on `staff_assignments.permissions` for the target org.
- Personal BodyFuel Strength Score V2 (`strength_checks`, `strength_check_results`, `performance_points`) remains completely separate. No policy on those tables was touched.

## What's next (follow-up turns)

1. Server-fn helpers: framework loader, result selection, change math, score engine, focus derivation
2. Athlete `/$orgSlug/performance` page
3. Coach performance tab (overview, team matrix, athlete detail, sessions)
4. Framework Builder (domains, batteries, tests, metric weights, position profiles, benchmarks)
5. Bulls framework seed (only as `status='draft'`; no fake benchmarks)
6. `manage_performance` / `view_performance` presets in staff role config
