# Wunschgewicht bis Datum – datenbasierte Kalorienberechnung

## Problem
Aktuell überschreibt das System das gewählte Trainingsziel automatisch (z. B. Stefan wird auf `aggressive_cut` gezwungen, obwohl er "Performance" gewählt hat). Das ist zu grob – es ignoriert, ob der User in 3 Monaten oder in einem Jahr sein Ziel erreichen will.

## Lösung
Trainingsziel bleibt unangetastet. Stattdessen wird das **Wunschgewicht + Zieldatum** zur Grundlage der Defizit-/Surplus-Berechnung.

### Neues Feld
- `profiles.goal_target_date` (date, nullable) – "Wunschgewicht erreichen bis …"

### Neue Logik in `compute_macro_targets`
1. Auto-Override des `training_goal` **entfernen**. Das vom User gewählte Ziel wird respektiert.
2. Falls `goal_weight_kg` und `goal_target_date` gesetzt sind:
   - `kg_diff   = goal_weight - current_weight`
   - `weeks     = max(2, (target_date - today) / 7)`
   - `rate_kg_w = kg_diff / weeks`   (negativ = Abnehmen, positiv = Zunehmen)
   - `kcal_delta_per_day = rate_kg_w * 7700 / 7`   (1 kg Körpermasse ≈ 7700 kcal)
3. Sicherheits-Clamps (pro Tag, abhängig vom Körpergewicht):
   - Abnehmen: max. `-1.0 % BW/Woche` ≈ ca. −20 % vom TDEE
   - Aufbau:   max. `+0.5 % BW/Woche` ≈ ca. +15 % vom TDEE
   - Untergrenze Kalorien: Frauen 1200, Männer 1500
   - Untergrenze Protein/Fett bleibt erhalten
4. Kalorien-Trainingstag = `TDEE + kcal_delta_per_day` (gerundet)
   Kalorien-Restday      = Trainingstag − 250 (mind. wie bisher)
5. Makros: Protein/Fett-g/kg richten sich nach dem **gewählten Trainingsziel** (Performance, Lean Bulk, Fat Loss, Aggressive Cut, Recovery) – also wie bisher, nur die Kalorienhöhe wird vom Zeitfenster diktiert.
6. Wenn `goal_target_date` fehlt → Fallback auf die bisherigen ziel-basierten Formeln (Performance × 37.5 etc.).

### UI
- **Onboarding & Profil**: neues Feld "Wunschgewicht erreichen bis" (Date-Picker) direkt neben `goal_weight_kg`.
- **Coach-Ansicht** (`coach.customers.$userId`): Anzeige des Zieldatums + berechneter Wochenrate ("≈ −0.6 kg/Woche") in der `CoachTrainingGoalCard`.
- Wenn kein Datum gesetzt ist: Hinweis "Kein Zieldatum gesetzt – moderate Standardberechnung aktiv".

### Trigger
`trg_profile_goal_recompute` zusätzlich auf Änderungen von `goal_target_date` und `goal_weight_kg` triggern.

## Dateien
- Migration: neue Spalte `goal_target_date`, neue Version von `compute_macro_targets`, erweiterter Trigger.
- `src/routes/profile*` / Onboarding-Komponente: Date-Input.
- `src/components/bodyfuel/CoachTrainingGoalCard.tsx`: Zieldatum + Wochenrate anzeigen.
- `src/lib/training-goals.ts`: kleine Util `weeklyRate(current, goal, date)` für die Anzeige.

## Beispiel Stefan (65 → 58 kg, Performance)
- Zieldatum **in 3 Monaten** (~13 Wochen): rate −0.54 kg/Woche → ca. −590 kcal/Tag → ≈ 1900 kcal Trainingstag (statt 2200 oder 1650).
- Zieldatum **in 6 Monaten** (~26 Wochen): rate −0.27 kg/Woche → ca. −295 kcal/Tag → ≈ 2200 kcal Trainingstag (moderates Defizit, Performance bleibt machbar).
- Zieldatum **in 8 Wochen**: rate −0.875 kg/Woche → gekappt auf max. −1 %/Woche → aggressives Defizit, aber sauber begrenzt.
