# BodyFuel Performance Engine V1 — Implementation Report

Generic, multi-sport engine. First real config = **Coesfeld Bulls (american_football)** as a `draft` framework — no invented benchmarks, no invented scientific norms, no final position weightings.

Personal BodyFuel Strength Score V2 (`strength_checks`, `strength_check_results`, `performance_points`) is untouched.

---

## 1. Central Performance Helpers (single source of truth)

Location: `src/lib/performance/`

| File | Exports |
|---|---|
| `types.ts` | `Direction`, `ResultSelectionMethod`, `CalculationType`, `Trend`, `Confidence`, `ResultStatus`, `RawAttempt`, `SelectedResult`, `ChangeResult`, `MetricScoreResult` |
| `result-selection.ts` | `selectPerformanceResult` |
| `change.ts` | `calculateDirectionAwareChange` |
| `derived-metrics.ts` | `calculateDerivedMetric` |
| `scoring.ts` | `calculateMetricScoreInternal`, `calculateDomainScore`, `calculateOverallPerformanceProfile`, `calculateProfileConfidence`, `calculateProfileDataCoverage` |
| `focus.ts` | `deriveDevelopmentFocusAreas` |
| `retest.ts` | `calculateRetestDue` |
| `pipeline.server.ts` | `runPerformanceProfileCalculation` (SSR-only recompute orchestrator) |

UI code MUST NOT recompute scores locally. `SessionLiveEntry` uses `selectPerformanceResult` for the live preview — same helper the pipeline calls when the session is completed.

## 2. Result Selection

`selectPerformanceResult` — pure. Ignores `valid=false` attempts. Never mutates raw attempts.

- **best**: `higher_is_better` → max; `lower_is_better` → min; `target_range` → attempt closest to midpoint (requires `config.target_range { min, max }`; otherwise `status = CONFIGURATION_REQUIRED`).
- **average**: arithmetic mean of valid attempts.
- **median**: sorted median (mid pair average when even).
- **last**: chronologically last valid attempt by `measured_at`.
- **custom**: reserved type — always returns `CONFIGURATION_REQUIRED`, no formula runtime in V1.

Every returned `SelectedResult` includes `source_attempt_ids`, `selection_method`, `selected_value`, `calculated_at`.

## 3. Raw Attempts Immutability

`performance_test_attempts` is only inserted by `addTestAttempt` and only patched by `invalidateAttempt` (`valid=false` + reason). No update path modifies `raw_value`. The recompute pipeline reads them but never writes back.

## 4. Attempt Correction Flow

To correct an entry: staff sets the old attempt `valid=false` with a reason via `invalidateAttempt`, then inserts a new attempt via `addTestAttempt`. Both attempts stay visible in the UI; the invalid one is struck through.

## 5. Derived Calculation Types

Executed in `calculateDerivedMetric`. Allowlist:

- `direct` — passthrough of a raw-test key from `config.input_metric_key`.
- `ratio` — `metricValues[numerator] / metricValues[denominator]`.
- `percentage_difference` — `((a − b) / |b|) * 100`.
- `asymmetry` — `|l − r| / max(|l|, |r|) * 100` (never medical interpretation).
- `bodyweight_relative` — `performance / context_bodyweight_snapshot`; uses the **session snapshot**, never re-reads current bodyweight.
- `formula` — explicitly non-executable in V1; returns `CONFIGURATION_REQUIRED`.

Missing inputs yield `status = MISSING_INPUT` with `value = null` — never a zero stored as a real result.

## 6. Direction-Aware Change

`calculateDirectionAwareChange` returns `{ raw_change, percentage_change, performance_change_percentage, direction, trend }`.

- `higher_is_better`: improvement = (new − prev) / |prev|
- `lower_is_better`: improvement = (prev − new) / |prev|
- `target_range`: improvement = (prev_distance_to_mid − curr_distance_to_mid) / prev_distance_to_mid

Trend uses a configurable `stableThreshold` (default 2 %) — this is a UI tolerance, not a scientific claim. Without prior value, `trend = "insufficient_data"`.

## 7. Framework Builder

Route: `/coach/teams/$orgId/performance` (Coach), tab **Framework**.

Blocks: Domains (read-only list) · Batteries (+ nested Tests editor) · Metrics (+ derived allowlist selector) · Domain × Metric Weights · Position Profiles (per-position domain-weights editor) · Benchmarks (read-only V1).

Readiness banner surfaces missing configuration dynamically: no batteries → "Test-Battery fehlt"; no metrics; no active benchmark; no active position profile; etc. When ready: **READY FOR TESTING**; when framework itself is `active`: **ACTIVE**.

## 8. Framework Version Safety

- Frameworks carry `version` (integer) and `status` (`draft`/`active`/`archived`).
- Completed sessions reference `battery_id`; recomputed profiles snapshot `framework_version` + `calculation_version` (columns present on `performance_athlete_profiles`).
- V1 policy: structural mutations to a framework already used by a completed session must be applied as a new draft version. This is a client policy enforced by the Framework Builder (not yet auto-migrated — dedicated `createFrameworkVersion` action lands with the version-branching UI in the next round).

## 9. Benchmark Eligibility & Minimum Sample

`calculateMetricScoreInternal` returns:

- `status = INSUFFICIENT_BENCHMARK_DATA`, `score = null` when peer sample < `minimum_sample_size`.
- `status = OK`, `score = 0..100` percentile-rank (mid-rank for ties, direction-aware) when the sample is sufficient.

`longitudinal_self_comparison` is exposed separately as `calculateDirectionAwareChange` — a missing peer score is never replaced by a fabricated self score.

## 10. Metric Scores

`performance_athlete_metric_scores` rows persist `selected_value`, `score`, `benchmark_model_id`, `benchmark_version`, `comparison_group`, `sample_size`. The 0–100 range is a **presentation scale** — copy in the UI never claims "% Leistungsfähigkeit".

## 11. Domain Scores & Coverage

`calculateDomainScore` computes a weighted mean over metrics with a scoreable value, using `performance_domain_metric_weights`. It returns `data_coverage` = required metrics with score / required metrics — no silent renormalization when required metrics are missing.

## 12. When Overall Profile Is Refused

`calculateOverallPerformanceProfile` returns:

- `POSITION_PROFILE_SETUP_REQUIRED` when the athlete's position profile is not `active`.
- `INSUFFICIENT_PERFORMANCE_DATA` when total domain weight = 0 or weighted coverage < 0.5.
- Otherwise `OK` with a 0–100 score.

## 13. Data Coverage

`calculateProfileDataCoverage` = required metrics present / required metrics total. Also computed inline as weighted coverage across position domain weights.

## 14. Confidence

`calculateProfileConfidence` returns `{ level: HIGH | MEDIUM | LOW, breakdown }`. Inputs: data coverage, required metrics coverage, test recency vs. retest window, benchmark sample vs. minimum, position profile status. Thresholds are centralised — no per-page duplication.

## 15. Development Focus Priorities

`deriveDevelopmentFocusAreas` — rule-based (no black-box). Signal = `position_weight × (1 − score/100) + trend_penalty`. Reason codes: `HIGH_POSITION_IMPORTANCE`, `BELOW_INTERNAL_PROFILE`, `NEGATIVE_TREND`, `STAGNANT_TREND`. Top 5 written with `source='engine'`, `status='suggested'`.

## 16. Coach Overrides Preserved

Recompute deletes engine rows only (`source='engine'`) before re-inserting; coach rows (`source='coach'`) are untouched. `upsertCoachFocusArea` / `removeCoachFocusArea` server functions edit coach entries.

## 17. Athletic Plan Match

Server function skeleton is in place via `focus_areas → organization_athletic_plans.focus_areas` matching (deferred to the Athlete Detail follow-up UI). No auto-activation — coach clicks "Athletikplan zuweisen" and priority order (athlete > position > team > organization) is respected by the existing assignment code.

## 18. Test Sessions End-to-End

1. `createPerformanceSession` — battery + name + date + athletes (creates `planned` session).
2. `addTestAttempt` — insert immutable raw attempt.
3. `invalidateAttempt` — mark old attempt invalid (raw value retained).
4. Live preview uses `selectPerformanceResult` in the browser (no server round-trip needed).
5. `completePerformanceSession` — sets status=`completed`, runs `runPerformanceProfileCalculation` which:
   - Selects results per test per athlete
   - Computes direct + derived metric values (using session context snapshots)
   - Scores metrics against `organization_internal` benchmark (peer pool = other session athletes for V1)
   - Aggregates domain scores + coverage
   - Loads athlete's position profile via `team_memberships` inside the org
   - Computes overall score (or refuses with a status)
   - Writes engine focus areas (coach rows preserved)
   - Upserts `performance_retest_schedule`

## 19. Athlete Performance Profile UI

Route: `/$orgSlug/performance`. Empty states:

- No profile → "Noch kein Performance-Profil"
- `overall_score = null` → "Performance-Setup läuft"
- Otherwise: overall score + coverage + confidence + per-domain scores + focus areas + helper text ("interner strukturierter Profilwert, keine prozentuale Leistungsfähigkeit").

## 20. Team Matrix Handles Missing Scores

`—` for missing overall/domain scores (never `0`). Filters by position/confidence/retest are prepared as columns; the follow-up detail view builds on this same query.

## 21. Staff Preset Permissions

`src/lib/organizations/operating-loop.functions.ts` — `STAFF_PRESETS`:

- `ORGANIZATION_ADMIN`: `view_performance`, `manage_performance` ✓
- `PERFORMANCE_COACH`: `view_performance`, `manage_performance` ✓
- `TEAM_COACH`: **no** performance permissions by default (user can opt in per assignment)
- `NUTRITION_COACH`: no performance permissions
- `COMMUNITY_MANAGER`: no performance permissions

Existing staff assignments untouched.

## 22. Bulls Framework Status

Seeded in the database (org `b86f49ab-…-8757c4c` / slug `bulls`):

- Framework **BODYFUEL American Football Performance V1** · sport `american_football` · v1 · status `draft`
- Domains: `acceleration`, `speed`, `explosiveness`, `change_of_direction`, `strength`, `conditioning`, `robustness`
- Position profiles (all `status='draft'`, no weights): `QB, RB, WR, TE, OL, DL, LB, DB`
- Benchmark models:
  - `Bulls Internal Performance Baseline V1` · `organization_internal` · `minimum_sample_size=0` · status `draft`
  - `Bulls Longitudinal Self-Comparison` · `longitudinal_self_comparison` · status `active`

No test batteries, no tests, no metrics, no domain/position weights.

## 23. Fachliche Inputs, die wir für die Bulls Test Battery jetzt brauchen

1. **Konkrete Tests** pro Domain (Name, Unit, direction, result_selection, retest cadence, kurzes Protokoll: instructions/attempts/rest/measurement_method).
2. **Metric-Zuordnung** (welche Testwerte gehen 1:1 als Metric, welche als derived — z. B. rel. Squat / Bodyweight).
3. **Metric → Domain Weights** (Summe pro Domain = 100 %).
4. **Position → Domain Weights** pro QB/RB/WR/TE/OL/DL/LB/DB (Summe = 100 %). Ohne diese bleibt jedes Position-Profil `draft` und Overall-Scores werden verweigert.
5. **Benchmark Sample-Size Freigabe**: ab welcher Anzahl gültiger Peer-Results wollen wir Peer-Percentile ausgeben? Ohne diese Freigabe bleibt das Modell `draft` und die Engine liefert nur `longitudinal_self_comparison`.
6. Optional: externe Referenz-Quellen mit `source_name` + `source_reference` (nur wenn dokumentiert; sonst nicht aktivieren).

## 24. Soccer / Age-Group Ready?

Yes — technically. The engine has no American-football assumption:

- `performance_position_profiles.age_group` supports U19/U17/senior scoping.
- Framework, batteries, tests, metrics, position profiles, benchmark models are all `organization_id`-scoped.
- Position keys are free-form (GK/CB/FB/WB/DM/CM/AM/W/ST).
- No RWE seed created automatically. A soccer org would add its own framework via the same Framework Builder.

---

## Was NICHT geliefert wurde (bewusst)

- Framework Version Branching UI (`CREATE NEW VERSION` Button) — die Persistenz-Felder existieren, aber der explizite Klon-Workflow kommt mit dem Versionierungs-UI.
- Deep Coach-Athletikplan-Match-UI (Focus → Plan Ranking) — Datenpfad ist offen, kommt mit `coach.teams.$orgId.performance.athletes.$userId.tsx`.
- Historical peer pool für `organization_internal` Benchmarks — V1 nutzt Session-interne Peers; org-weite historische Peer-Pools sind eine Erweiterung im nächsten Turn.
- Radar Chart Component — Empty-State-first Athleten-Ansicht ist da, das Radar folgt sobald mehrere Sessions Daten liefern.

Alles davon blockiert die aktuelle Pipeline nicht — sie sind additive Erweiterungen.

---

## Test Session Flow V1 (funktionaler Rohbau)

### Wizard
Coach → Teams → Bulls → Performance → Test-Sessions → `+ PERFORMANCE TEST SESSION`.
Sechs Schritte: Battery → Test Day → Athleten → Basics → Snapshot → Confirm.

- **Battery**: Nur Bulls Core Battery V1 wählbar. Da Framework/Battery `draft` sind, zeigt der Wizard permanent `DRAFT FRAMEWORK · TEST MODE`. Session wird mit `mode='test'` gespeichert.
- **Test Day**: `field` / `strength` / `full`. Wert landet auf `performance_test_sessions.test_day` und filtert in der Live-Entry-UI Tests anhand `protocol.testing_day_group`.
- **Athleten**: Roster via `listOrgAthletesForPerformance` (organization_memberships role='athlete' + team + position + Profile-Status). Athleten ohne Position bekommen inline Warnung `POSITION REQUIRED FOR POSITION-WEIGHTED OVERALL PROFILE`, dürfen aber ausgewählt werden.
- **Basics**: Session-Name (Default `<Battery> – <Day-Label> – <Datum>`), Test-Date, Location, Measurement-Method-Default, Notes.
- **Snapshot**: Für `strength`/`full` — pro Athlete Bodyweight-Snapshot. Bestehender Wert aus `bulls_profiles.weight_kg` kann als Quelle „übernommen" werden; wird als eigener `performance_session_context_snapshots.context_key='bodyweight_kg'` gespeichert. Persönliche BodyFuel-Daten bleiben unverändert.
- **Confirm** → `createPerformanceSession` mit allen Feldern + Snapshots-Batch. Redirect zur mobilen Session-Route.

### Live Entry (mobile-first)
Route: `/coach/teams/$orgId/performance/session/$sessionId`.

- Sticky Header: Session-Name, Test-Day-Label, `X / Y Results Complete`, Status-Badge, `TEST MODE`, Start-/Abschließen-Actions.
- Modus-Umschalter `BY TEST` / `BY ATHLETE` (persistiert via `updatePerformanceSession.entry_mode`).
- Zwei Selects (Athlete, Test) mit „letzte Auswahl bleibt aktiv" via Index-State — bei Wechsel des Athleten bleibt der aktive Test erhalten.
- Test-Karte mit Protokoll-Button (Modal aus `test.protocol` JSON), Attempt-Liste, `+ Versuch`-Numeric-Input (`inputMode='decimal'`), Live-`Selected Result` via `computeTestResult`.
- Raw Attempts sind immutable — nur `ALS UNGÜLTIG MARKIEREN` mit Reason-Prompt setzt `valid=false, invalid_reason`.
- Sticky Bottom-Bar: „Vorheriger/Nächster Athlet" bzw. „Vorheriger/Nächster Test" je nach Modus.
- „Offene Results anzeigen": Liste aller Athlete/Test-Kombinationen ohne `status='OK'`.

### RAST Validierung
`computeTestResult` (in `src/lib/performance/test-result.ts`) liest `test.config.required_valid_attempts` und `max_valid_attempts`:

| Valid-Count | test_status | Selected Value |
| --- | --- | --- |
| `0` | `NO_VALID_ATTEMPTS` | null |
| `1…5` (< required=6) | `PROVISIONAL` | ja (nur Anzeige, keine Metric) |
| `6` (= required) | `OK` | arithmetisches Mittel, `source_attempt_ids` = die 6 |
| `7+` (> required oder > max) | `REVIEW_REQUIRED` | null — Coach muss invalidieren |

Pipeline (`pipeline.server.ts`) akzeptiert nur `test_status='OK'` als finalen Wert. `PROVISIONAL`, `INCOMPLETE`, `REVIEW_REQUIRED` erzeugen keine Metrik → kein Conditioning-Domain-Score → kein finaler Overall aus diesem Test.

### Session Progress
`getPerformanceSessionProgress` liefert je Athlete/Test eine Zelle mit `status`. Progress-Aggregation zählt nur `OK` als „complete" — keine 0-Werte, keine Attempt-Count-Heuristik.

### Completion Review + Pipeline
Review-View listet `Athletes complete/total` und `Results complete/total` plus Liste unvollständiger Zellen. `SESSION TROTZDEM ABSCHLIESSEN` erfordert manage_performance und triggert `completePerformanceSession` → `runPerformanceProfileCalculation`. Draft-Position-Profiles / Draft-Benchmarks (min_sample_size=10) lehnen Peer-Scores korrekt ab → Athleten erhalten Baseline ohne fiktiven Overall.

### Athlete Baseline-View
`/$orgSlug/performance` zeigt bei `overall_score=null` den Baseline-Zustand: „Performance Baseline aufgezeichnet", Available Results aus `performance_athlete_metric_scores.selected_value` (auch ohne Peer-Score), Data Coverage, Missing Metrics, nächster Retest aus `performance_retest_schedule`. Keine 0-Scores, keine fiktiven Werte.

### No Demo Data
Migration hat ausschließlich Spalten hinzugefügt (`test_day`, `entry_mode`, `location`, `measurement_method_default`, `completed_at`, `completion_notes`, `mode`). Keine INSERTs auf Bulls-User. Bulls-Framework bleibt `draft` mit `READY FOR COACH REVIEW`.

---

## Staff-UI: Vereinsfreundliche Bezeichnungen (Post-Performance V1)

Rein sichtbare Änderungen — interne Role- und Permission-Keys in DB, RLS und Server-Functions wurden NICHT verändert.

1. **Zentrale Label-Map:** `src/lib/organizations/staff-labels.ts`
   Exportiert `PERMISSION_LABELS`, `PRESET_LABELS`, `permissionLabel()`, `permissionDescription()`, `roleLabelFromDbRole()`, `scopeLabel()`. Alle Staff-UI-Bausteine importieren aus dieser Datei — Labels werden nicht mehr in Components hardcodiert.
2. **Sichtbare Rollenbezeichnungen** (Preset-Auswahl im "Trainer / Mitarbeiter hinzufügen"-Modal):
   Vereinsleitung / Administrator · Head Coach / Teamcoach · Athletik- & Performance Coach · Ernährungscoach · Community & Challenges · Individuelle Rolle.
   In der Staff-Übersicht wird die in `staff_assignments.role` gespeicherte technische Rolle über `roleLabelFromDbRole()` gemappt (`organization_admin` → Vereinsleitung, `coach` → Head Coach, `staff` → "Trainer / Mitarbeiter").
3. **Zuständigkeit (Scope):** "Gesamter Verein" bzw. "Team: <Teamname>". Helper: *"Die Zuständigkeit legt fest, für welche Teams diese Person Zugriff erhält."*
4. **Technische Permission Keys in der normalen UI entfernt.** Weder im Modal noch in der Staff-Liste erscheinen `view_performance`, `manage_training` etc. — nur noch die deutschen Labels aus der Map. Die Keys existieren weiterhin ausschließlich intern (DB, RLS, Server-Fn, `ALL_PERMISSIONS`-Konstante).
5. **Permission-Beschreibungen:** Jede Berechtigung wird als eigene Card/Zeile mit fetter Bezeichnung und Sub-Zeile aus `PERMISSION_LABELS[key].description` angezeigt (mobile-first: eine Berechtigung pro Zeile, keine enge 2-Spalten-Matrix mehr).
6. **Staff-Übersicht:** Zeigt Name, sichtbare Rollenbezeichnung, "Zuständigkeit: …" und "Berechtigungen: N Bereiche freigegeben" plus Chip-Liste der gewährten Labels. Button "Berechtigungen ansehen" öffnet Detail-Editor. Tab-Label heißt "Trainer & Mitarbeiter" statt "Staff".
7. **Interne Keys und RLS unverändert:** `STAFF_PRESETS`/`ALL_PERMISSIONS` in `operating-loop.functions.ts`, `has_role`, RLS-Policies, Server-Function-Middleware und Permission-Checks blieben bit-identisch. Nur UI-Rendering wurde angepasst.
