# Smart Training Plan

Analog zum bestehenden Smart-Ernährungsplan: Die KI erzeugt einen Trainingsplan-Entwurf, sobald der Kunde den Strength Check abgeschlossen hat. Der Coach kann ihn im Coaching-Menü prüfen, freigeben, veröffentlichen und aktivieren — danach läuft das bestehende Tracking + Fortschritt + Punkte-System unverändert weiter.

## Was der Kunde davon hat

- Nach dem Strength Check erscheint im Training automatisch ein „Smart Trainingsplan wird erstellt"-Bereich. Sobald der Coach freigegeben hat (oder Auto-Publish aktiv ist), wird der Plan aktiv und im gewohnten Tracker angezeigt.
- Plan enthält alles, was ein Standard-Studio bietet: Langhantel-Übungen, Kurzhantel-Übungen, Geräte/Maschinen, Cardio-Block, Core-Block. Jede Übung mit Sätzen, Wiederholungen, Startgewicht (basierend auf Strength-Check-e1RM) und Notizen.
- Übungsnamen werden zusätzlich an bereits vorhandene Übungsnamen des Kunden angeglichen (Aliase wie „Bankdrücken Langhantel" → „Bankdrücken"), damit Historie, PRs und Charts ohne Bruch weiterlaufen.

## Was der Coach davon hat

Auf der Kunden-Detailseite (`/coach/customers/:userId`) neue Karte **„Trainingsplan Management"** direkt unter der bestehenden Ernährungs-Karte. Identisches Layout & Verhalten:

- Buttons: **„Smart-Plan generieren"** / **„Plan ab nächster Woche"**.
- Zwei Spalten: Aktiver Plan / Nächster Plan, mit Status-Badges (Entwurf · Freigegeben · Veröffentlicht · Aktiv · Archiviert).
- Aktionen pro Plan: Bearbeiten · Vorschau · Termine · Freigeben · Veröffentlichen · Jetzt aktivieren · Löschen · Archivieren.
- Checkbox „Automatisch aktivieren" (wenn aus → Coach-Freigabe nötig).
- Planarchiv darunter.

## Technische Details

### Datenbank
Es wird kein neuer Status oder neue Tabelle gebraucht — `nutrition_plans` hat bereits `plan_type='training'`, und `training_days` / `training_exercises` sind vollständig vorhanden. Eine kleine Migration ergänzt nur:

- Spalte `smart_training_profile` in `profiles` ist nicht nötig — Settings wie Auto-Publish-Training landen direkt im bestehenden `smart_nutrition_profile` als neue Spalten `auto_publish_training boolean` und `training_session_minutes int` (Standard-Dauer pro Einheit).
- Wir fügen pro Übungszeile zwei optionale Spalten in `training_exercises` hinzu: `rest_seconds int` und `category text` ('barbell' | 'dumbbell' | 'machine' | 'cardio' | 'core' | 'bodyweight'), damit Coach-/Filter-/Anzeige-Logik sauber bleibt.

### Server-Funktionen
- `src/lib/training-plan-ai.functions.ts` neu — `generateAiTrainingPlanDraft({ user_id, start_mode })`:
  1. Lädt Profil + Strength-Check (letzter) + Trainingsziel + Trainingswochentage (aus `smart_nutrition_profile.training_weekdays`) + bisherige Übungsnamen (für Alignment).
  2. Berechnet Startgewichte je Übungstyp aus Strength-Check-e1RM (z. B. Bankdrücken-Startgewicht ≈ `chest_press_e1rm × 0,75` bei 8 Wdh., Kniebeuge ≈ `leg_press_e1rm × 0,35`, etc.).
  3. Ruft Lovable AI Gateway mit detailliertem Prompt auf: liefert JSON `{ days: [{ name, focus, exercises: [{ name, category, target_sets, target_reps, target_weights, rest_seconds, notes }] }] }`.
  4. Aligniert Übungsnamen gegen bestehende `training_exercises` des Kunden (Levenshtein/Substring + Synonym-Liste).
  5. Archiviert vorherigen draft/approved/published Training-Plan; legt neuen `nutrition_plans`-Eintrag mit `plan_type='training'`, `source='smart_ai'`, `status='draft'` an; befüllt `training_days` + `training_exercises`.
- `src/lib/training-plan-management.functions.ts` neu — spiegelt `plan-management.functions.ts`, aber für `plan_type='training'`. Funktionen: `getCustomerTrainingPlanOverview`, `transitionTrainingPlanStatus`, `deleteTrainingPlanDraft`, `updateTrainingPlanScheduling`, `setAutoPublishTraining`. Beim Aktivieren wird der vorherige aktive Trainingsplan archiviert (analog Ernährung), aber keine Makro-Targets gesetzt.

### UI
- `src/components/bodyfuel/TrainingPlanManagementCard.tsx` neu — analog `PlanManagementCard.tsx`, aber für Training. Eingebaut in `coach.customers.$userId.tsx` direkt unter der Ernährungs-Karte.
- `src/components/bodyfuel/StrengthCheckStatus.tsx`: nach absolviertem Check zusätzlich kleine Karte „Dein Smart-Trainingsplan wird vorbereitet" (zeigt Status: in Bearbeitung / freigegeben / aktiv).
- Vorschau (`/coach/plan-preview/:planId`) unterstützt bereits beide Plantypen — kein Eingriff nötig, prüfen, dass Training-Days/Exercises angezeigt werden.

### Tracking & Fortschritt
Da AI-Übungen in `training_exercises` landen und der bestehende `TrainingTracker` direkt diese Tabelle liest, funktionieren Tracking, Punkte (Trigger `process_training_set`), Fortschritts-Charts und Strength-Check-Updates automatisch weiter. Durch das Namens-Alignment bleiben PRs/Historie über Plan-Wechsel hinweg verknüpft.

## Reihenfolge der Umsetzung

1. Migration: neue Spalten in `smart_nutrition_profile` und `training_exercises`.
2. `training-plan-ai.functions.ts` (Generierung inkl. Namens-Alignment).
3. `training-plan-management.functions.ts` (Coach-CRUD).
4. `TrainingPlanManagementCard` + Einbau in Coach-Kundenansicht.
5. Hinweis-Karte im Kundenbereich nach Strength Check.
6. Smoketest: Strength Check abschließen → Coach erstellt Plan → freigeben → aktivieren → Kunde sieht Plan im Tracker → Satz loggen → PR-Punkte werden vergeben.

## Bewusst nicht enthalten

- Eigene Einkaufslisten-/PDF-Logik für Training (gibt es bei Training nicht).
- Auto-Progression / Deload-Logik in der KI-Generierung — wird mit künftigen Strength-Checks Schritt für Schritt nachgezogen (Daten dafür sind bereits gespeichert).
- Bestehender PDF-Upload-Workflow (`parseTrainingPlan`) bleibt unverändert nutzbar.
