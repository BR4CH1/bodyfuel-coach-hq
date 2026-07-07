# BodyFuel Performance Auto Plan Pipeline V1

Ziel: Bulls-/Performance-Athleten erhalten Ernährungspläne automatisch, sobald der Coach Teamtraining plant. Kein „Plan erstellen"-Button mehr im Bulls Hub. Persönlicher BodyFuel-Kontext bleibt unangetastet.

## Bestandsaufnahme (recon)

Wiederverwendbar (unverändert): `getBullsDailyNutritionTargets`, `getNutritionTargetForDate`, Performance-Engine, `resolvePerformanceDayType`, `nutrition_plans/_days/_meals/_meal_overrides`, `nutrition_plan_meals.is_locked` + `linked_prep_group`, `coach_meal_library` (Recipe Pool inkl. `suitable_training/rest`, `meal_slot`, `no_go_ingredients`, `mealprep_ok`), `food_entries` (Tracking), `smart_autopilot_jobs` + `/api/public/hooks/process-autopilot-jobs.ts` (Cron-Worker).

Fehlt / muss neu: org-Scoping auf `nutrition_plans`, per-Datum-Adressierung, `modification_source`, deterministischer Meal-Selektor aus `coach_meal_library` (kein LLM), Team-Job-Tabelle, Trigger-Wiring, Reoptimizer, Team-Publish-Hook.

## Umsetzung (in dieser Reihenfolge)

### 1. DB-Schema-Erweiterungen (Migration, additiv)

- `nutrition_plans`: `organization_id uuid null`, `performance_context bool default false`. Partial-Index `unique (client_id, organization_id) where performance_context and status='active'` — 1 aktiver Performance-Plan pro (User, Org).
- `nutrition_plan_days`: `plan_date date null`. Backfill nicht nötig (nur Performance-Pläne setzen es).
- `nutrition_plan_meals`: `modification_source text null` — Enum via CHECK: `auto_generated|athlete_swapped|athlete_locked|coach_fixed`.
- `performance_plan_jobs`: `id, organization_id, team_id null, week_start date, trigger text, status (pending|processing|completed|completed_with_errors|failed), total/processed/generated/updated/skipped/failed counts, started_at/completed_at, created_by, unique (organization_id, team_id, week_start, trigger, coalesce(dedupe_key,'')) where status in ('pending','processing')` — verhindert Doppel-Jobs.
- `performance_plan_history`: `id, user_id, organization_id, date, trigger, action (GENERATED|REOPTIMIZED|NO_CHANGE|SKIPPED_PAST_DATE|SKIPPED_PROFILE_INCOMPLETE|SKIPPED_TRACKED_DAY|FAILED), previous_day_type, new_day_type, previous_target_kcal, new_target_kcal, engine_version, job_id, flags jsonb, created_at`.
- RLS: Athlet liest eigene History; Coach/Staff der Org liest alle. Jobs: Staff read/insert.
- GRANTs für `authenticated` + `service_role` gemäß Cloud-Regeln.

### 2. Pure Meal-Selektor (kein LLM, kein I/O)

Datei `src/lib/performance-nutrition/plan-builder.ts`:

- `pickMealsForDay({ target, dayType, preferences, poolMeals })` — greedy + backtracking:
  1. Slot-Reihenfolge: `breakfast → lunch → dinner → snack (optional) → pre_workout (bei training/game/double)`.
  2. Filter Pool: `suitable_training/rest` je DayType, `no_go_ingredients ∩ athlete no-gos = ∅`, Slot-Match.
  3. Wähle Meal mit geringster Protein-Distanz zum Slot-Anteil, dann Kalorien-Distanz.
  4. Skaliere Portion (linear auf kcal), cap [0.5×, 2.0×]. Bei Cap: nächste Kandidatin.
  5. Prüfe Ziele: kcal ±5 %, protein ±10 %, carbs ±10 %, fat ±10 %. Bei Training: Protein/Carb-Floor > kcal-Exaktheit.
- `reoptimizeExistingDay({ existingMeals, newTarget, locked, prepGroups, tracked })` — Prioritäts-Ladder: (a) Mengen skalieren, (b) Snack ergänzen, (c) eine ungelockte Mahlzeit ersetzen, (d) Tag komplett neu. `linked_prep_group` erhält einheitlichen Skalierungsfaktor über gekoppelte Meals.
- Unit-testbar, deterministisch (Seed via `user_id+date`).

### 3. Athleten-Pipeline (Server-Fn)

`src/lib/performance-nutrition/auto-plan.functions.ts`:

- `generateOrUpdatePerformanceNutritionWeek({ organizationId, userId, weekStart, trigger, jobId? })`:
  - Für jedes Datum weekStart..+6:
    - `date < today` → `SKIPPED_PAST_DATE`.
    - `collectPerformanceDayTypeSignals` + `resolvePerformanceDayTypeFromSignals` (Resolver, schon fertig).
    - `getNutritionTargetForDate` (org-scoped, active target aus Read Layer).
    - Bei `MISSING_DATA`/kein Target → `SKIPPED_PROFILE_INCOMPLETE`.
    - Bestehenden Performance-Plan-Day laden (`nutrition_plans where organization_id AND performance_context AND client_id=user AND status='active'`, dann `plan_date=date`). Vergleiche `previous_day_type/kcal` mit `new_*`.
    - Unverändert → `NO_CHANGE`.
    - Tag existiert nicht → `pickMealsForDay` → INSERT `plan_day` + `plan_meals` (`modification_source='auto_generated'`) → `GENERATED`.
    - Tag existiert & Änderung → `reoptimizeExistingDay` (respektiert `is_locked`, `modification_source in (athlete_locked, coach_fixed)`, `linked_prep_group`, getrackte Meals via `food_entries`-Prefix `perf_plan:*`) → `REOPTIMIZED`.
    - `date === today` + Tracking vorhanden → nur ungetrackte Slots reoptimieren, sonst `SKIPPED_TRACKED_DAY` oder Flag `ACTIVE_DAY_REPLAN_REVIEW_REQUIRED`.
  - Alles in `performance_plan_history` protokollieren (`job_id`).
  - Rückgabe: `{ generated, updated, skipped, failed, actions[] }`.

### 4. Team-Pipeline & Job-Worker

- `processPublishedPerformanceWeek({ organizationId, teamId, weekStart, trigger, createdBy })` schreibt eine `performance_plan_jobs`-Zeile (Unique-Index verhindert Doppel-Job) und weckt den Cron-Worker.
- **Wiederverwendung** von `smart_autopilot_jobs` NICHT — es ist personal-scoped und hat kein Org/Team. Stattdessen neue Route `/api/public/hooks/process-performance-plan-jobs.ts` nach dem gleichen Muster (1 Athlet pro Request-Iteration, Retry, `attempts<3`). pg_cron-Job alle 30 s.
- Worker-Loop: pending Job holen (SKIP LOCKED), erste noch nicht verarbeitete Athlete-ID aus `active team_memberships` mit `performance_nutrition_profiles`-Row auswählen, `generateOrUpdatePerformanceNutritionWeek` aufrufen, Zähler updaten, bei letztem Athleten `completed`/`completed_with_errors`. Ein Athletenfehler stoppt den Job nicht.
- Concurrency: Row-Level `SELECT ... FOR UPDATE SKIP LOCKED` auf Jobs + Athlet-Fortschritts-Tracking via `performance_plan_history` (bereits geschriebene History-Zeile = Athlet fertig für diesen Job).

### 5. Trigger-Wiring

- `type PerformancePlanTrigger = "WEEK_PUBLISHED"|"TEAM_SCHEDULE_CHANGED"|"GAME_ADDED"|"GAME_REMOVED"|"ATHLETIC_PLAN_CHANGED"|"PERFORMANCE_PROFILE_COMPLETED"|"PERFORMANCE_GOAL_CHANGED"|"WEIGHT_TARGET_RECALCULATED"|"CALIBRATION_CHANGED"`.
- Da kein expliziter Team-Publish-Flow existiert: die Team-Training-Schreib-Server-Fns (`organization_team_training_schedule` upsert/delete) erhalten am Ende einen `enqueuePerformancePlanJob(trigger='TEAM_SCHEDULE_CHANGED')`-Call für die betroffene Woche. Athleten-Trigger (`PERFORMANCE_PROFILE_COMPLETED`, `PERFORMANCE_GOAL_CHANGED`, `CALIBRATION_CHANGED`) enqueuen einen Single-Athlete-Job (team_id=null).
- Der Coach drückt keinen zusätzlichen Button.

### 6. UI-Anpassung (minimal)

- `BullsPlanContentView`: leerer State zeigt „Deine Performance-Woche wird vorbereitet." wenn `performance_plan_jobs` pending/processing für die Woche existiert, sonst „Noch kein Plan — dein Coach hat noch keine Woche geplant." Kein „Plan erstellen"-Button mehr. Plan-Read bleibt via bestehende Query (jetzt gefiltert auf `performance_context=true` + `organization_id`).
- Persönlicher BodyFuel-Read-Path bleibt unverändert (`performance_context=false OR IS NULL`).

### 7. Idempotenz & Dual-Role-Trennung

- Idempotenz: (a) Job-Unique-Index, (b) Vergleich previous vs. current im Athleten-Loop → `NO_CHANGE`, (c) `plan_meal` UPSERT auf `(day_id, sort_order)` mit `modification_source='auto_generated'` (nur diese Zeilen dürfen ersetzt werden).
- Dual-Role: Alle Reads/Writes der Pipeline filtern hart auf `performance_context=true` + `organization_id`. Persönliche Pläne (`performance_context=false`) werden nie berührt.

### 8. Tests (vitest)

`src/lib/performance-nutrition/__tests__/`:
- `plan-builder.test.ts` — Meal-Selektor pure (Ziel-Toleranzen, Slot-Reihenfolge, No-Go-Filter, Skalierungs-Cap).
- `reoptimizer.test.ts` — Ladder (Mengen → Snack → Ersetzen → Neu), Locked-Respekt, Mealprep-Konsistenz, getrackte Slots geschützt.
- `auto-plan-flow.test.ts` — mit In-Memory-Supabase-Mock: 15 Szenarien aus dem Auftrag (neue Woche, identisch, REST→FT, FT+STR→DS, Game, Vergangenheit, heute mit/ohne Tracking, locked, mealprep, unvollständiges Profil, Dual-Role, 1 Fehler in 50, doppelter Job, Youth ohne Target).

## Technische Details (kompakt)

```text
Trigger (Coach save / Athlete profile) 
  → enqueuePerformancePlanJob (INSERT performance_plan_jobs)
  → pg_cron (30 s)
  → /api/public/hooks/process-performance-plan-jobs (apikey)
  → für jeden Athleten: generateOrUpdatePerformanceNutritionWeek
      → resolvePerformanceDayType   (bereits fertig)
      → getNutritionTargetForDate   (bereits fertig)
      → pickMealsForDay | reoptimizeExistingDay
      → INSERT/UPDATE nutrition_plans/_days/_meals   (org-scoped, performance_context=true)
      → INSERT performance_plan_history
```

## Ausdrücklich NICHT in diesem Schritt

Session-Intensity-UI, Coach-Override-Actions, Push-Notifications, Änderungen am persönlichen Plan-Erstellen-Flow, LLM-basierte Meal-Generierung für Performance (deterministischer Selektor aus `coach_meal_library`).

## Offene Fragen zur Freigabe

1. **`coach_meal_library` als alleiniger Recipe Pool für Performance ok?** Fallback: wenn Pool zu klein/lückig für einen Slot, `SKIPPED_PROFILE_INCOMPLETE` mit Flag `LIBRARY_TOO_SPARSE` (kein LLM-Fallback in V1).
2. **`nutrition_plans.organization_id` + `performance_context`-Flag ok?** Alternative wäre eine separate `performance_nutrition_plan_assignments`-Tabelle — mehr Umbau, weniger Reuse.
3. Migration führt einen additiven Change auf `nutrition_plans` durch (nullable Spalten, kein Backfill). Freigabe für die Migration erteilst du beim Migrationsschritt selbst.
