## Ziel

Ein manueller Trainings-Plan-Builder für Coaches, funktional analog zum bestehenden `PlanBuilderPage.tsx` (Ernährung). Mehrere Wochen, Übungen pro Trainingstag mit Sätzen/Wdh/Gewicht/RIR/Pause/Notiz, Draft + Publish, Auto-Fill-Vorschlag, Partner-Kopplung, kuratierte Übungsbibliothek + Freitext-Fallback.

## Datenmodell — bestehendes wiederverwenden

Der Smart-AI-Trainingsplan schreibt bereits in:

- `nutrition_plans` mit `plan_type='training'` (Container: `client_id`, `title`, `status`, `scheduled_start_date`, `weeks_count`, `is_partner_plan`, `partner_plan_id`)
- `training_days` (`plan_id`, `name`, `sort_order`, `week_number`)
- `training_exercises` (`day_id`, `name`, `category`, `target_sets`, `target_reps`, `target_weights`, `rest_seconds`, `notes`, `sort_order`)

→ Kein Schema-Umbau für den Core-Plan nötig. Zusätze:

1. Neue kuratierte Übungsbibliothek `coach_exercise_library` (analog `coach_meal_library`):
   - `id`, `name`, `category` (barbell/dumbbell/machine/cable/cardio/core/bodyweight), `primary_muscle`, `secondary_muscles text[]`, `equipment text[]`, `movement_pattern` (squat/hinge/push_h/push_v/pull_h/pull_v/carry/core/cardio), `is_unilateral`, `difficulty` (beg/int/adv), `default_sets`, `default_reps`, `default_rest_seconds`, `notes`, `is_active`, `created_at`, `updated_at`.
   - GRANT SELECT authenticated; RLS: alle authentifizierten lesen, nur Coach schreibt.
   - Seed-Migration mit ~60–80 Standardübungen abgedeckt über alle Movement Patterns.

2. Zusätzliche Spalten in `training_exercises`:
   - `library_exercise_id uuid` (nullable, FK → `coach_exercise_library.id` ON DELETE SET NULL)
   - `target_rir smallint`
   - `is_locked boolean DEFAULT false`
   - `linked_partner_group text` (Kopplung an Partner-Übung)
   Optional: `partner_exercise_id uuid` (Kreuzverknüpfung analog `partner_meal_id`).

3. Zusätzliche Spalte in `training_days`:
   - `day_date date` (analog `nutrition_plan_days.day_date`)

Alles in einer Migration, danach Types-Regenerierung.

## Server-Funktionen (`src/lib/training-plan-builder.functions.ts`)

Neu, spiegelt `plan-builder.functions.ts`:

- `listExerciseLibrary()` — coach-only, alle aktiven Bibliotheks-Übungen.
- `getCustomerTrainingContext({ customerId })` — liefert:
  - `trainingWeekdays` aus `smart_nutrition_profile.training_weekdays` (fallback aus letzten `training_sessions`),
  - `experienceLevel`, `mainGoal` aus `profiles`/`smart_nutrition_profile`,
  - `equipmentAvailable` (Bulls/Home/Gym),
  - Startgewichte aus letztem Strength-Check (V2 e1RM/×0.75 als Woche-1-Baseline für Bench, Squat, Deadlift, OHP, Row, Lat Pulldown, Leg Press, Leg Curl),
  - `injuries` / Kontraindikationen.
- `saveBuilderTrainingPlan({ customerId, title, startDate, weeksCount, days, publish })`
  - `days: BuilderTrainingDay[]` — pro `week_number` × Wochentag genau ein Eintrag, `type: "training" | "rest"`, `exercises[]` mit `slot`, `library_exercise_id?`, `name`, `category`, `target_sets`, `target_reps`, `target_weights`, `target_rir`, `rest_seconds`, `notes`, `is_locked`, `linked_partner_group?`.
  - Legt `nutrition_plans` mit `plan_type='training'` + `training_days` + `training_exercises` an, alte Draft/Approved-Trainingspläne desselben Kunden werden archiviert (wie AI-Core Zeile 478–483).
  - `publish=true` → `status='active'`.
- `saveBuilderPartnerTrainingPlan({ customerId, partnerId, ... clientDays, partnerDays, publish })`
  - Zwei Aufrufe an internen `persistBuilderTrainingPlan`, danach:
    - `is_partner_plan=true` und `partner_plan_id` kreuzweise setzen,
    - `training_exercises.partner_exercise_id` anhand `linked_partner_group` kreuzverlinken.

Alle Funktionen: `.middleware([requireSupabaseAuth])` + `assertCoach`.

## UI

Neue Route: `src/routes/coach.training-builder.$userId.tsx` → rendert neue Komponente `TrainingPlanBuilderPage` unter `AppLayout`.

Neue Komponente: `src/components/bodyfuel/TrainingPlanBuilderPage.tsx` — analog zu `PlanBuilderPage.tsx`, aber mit Trainings-Semantik:

- **Header**: Titel, Startdatum, Wochenanzahl (1–8, Default 4, Woche 4 automatisch Deload-Vorschlag), Publish-Toggle.
- **Wochennavigation**: Tabs Woche 1..N + „alle Wochen".
- **Pro Tag** (Mo–So):
  - Toggle Trainingstag/Ruhetag (Default aus `trainingWeekdays`, manuell überschreibbar).
  - Bei Trainingstag: Fokus-Titel („Push", „Unterkörper", …).
  - Liste von Übungen (Drag-Sort), pro Übung:
    - Übungs-Picker (kuratierte Bibliothek mit Filter Muskelgruppe/Equipment, Freitext-Fallback),
    - Sätze (Number), Wdh („8" oder „8,8,10"), Gewicht („60" oder „60,62,65"), RIR (0–5), Pause (Sek.), Notiz, 🔒 Lock, „Gemeinsam mit Partner"-Chip.
  - Add-Button für weitere Übungen; Copy-Day, Copy-Week, Clear-Day.
- **Auto-Fill**: „Vorschlag Tag" / „Vorschlag Woche" ruft eine reine Client-Heuristik `autoFillTrainingWeek(context)` auf:
  - Movement-Pattern-Verteilung nach Split (Full-Body / Push-Pull-Legs / Upper-Lower je nach Anzahl Trainingstage),
  - Startgewichte aus Strength-Check als Baseline (`e1RM × 0.75`, gerundet auf 2.5 kg), Progression pro Woche wie AI-Core (`weekCapFactor`),
  - respektiert `is_locked`,
  - Partner-Modus wählt bevorzugt Übungen, die für beide Movement-Patterns identisch sind.
- **Live-Zusammenfassung** pro Tag: Anzahl Sätze, geschätztes Volumen, Muskelabdeckung.
- **Partner-Toggle** (analog Ernährungsplan): wenn `nutrition_partners` gesetzt, „Partnerplan mit {Name}" freischaltbar → Tabs „Kunde | Partner", Auto-Fill koppelt gemeinsame Trainingstage.
- **Speichern**: „Als Entwurf speichern" bzw. „Für Kunden aktivieren" ruft `saveBuilderTrainingPlan` / `saveBuilderPartnerTrainingPlan`.
- Nach Speichern: Redirect auf `/coach/plan-preview/$planId` (existiert bereits, funktioniert mit `plan_type='training'`).

## Reihenfolge im Code

1. Migration:
   - `coach_exercise_library` + GRANT + RLS + Seed.
   - `ALTER training_exercises ADD library_exercise_id, target_rir, is_locked, linked_partner_group, partner_exercise_id`.
   - `ALTER training_days ADD day_date`.
2. `src/lib/training-plan-builder.functions.ts` (Types + 4 Server-Funktionen).
3. `src/lib/training-autofill.ts` (reiner TS-Helper für Vorschlagsgenerierung).
4. `src/components/bodyfuel/TrainingPlanBuilderPage.tsx`.
5. `src/routes/coach.training-builder.$userId.tsx`.
6. Einstiegspunkt: Button „Manuell Trainingsplan erstellen" in `TrainingPlanManagementCard.tsx` bzw. der Coach-Kundenansicht (nur wo bereits AI-Plan-Buttons existieren).

## Nicht Bestandteil

- Keine Änderung am AI-Trainingsplan-Flow.
- Keine Änderung an der Kunden-App-Trainingsansicht — sie liest bereits `training_days`/`training_exercises` und zeigt alle neuen Felder auf Wunsch später an (`target_rir` wird als optionale Info gerendert, sobald das UI dafür ergänzt wird — im ersten Wurf nicht Pflicht).
- Keine Progression-Automatik über 8 Wochen hinaus, keine Periodisierungsmodelle.
- Kein Selfservice-Builder für Endkunden.

## Nach Freigabe

Ich starte mit Schritt 1 (Migration inkl. Seed). Sobald die Migration freigegeben und die Types regeneriert sind, lege ich Server-Funktionen, Auto-Fill-Helper, UI und Route an — jeweils in dedizierten Commits/Batches.
