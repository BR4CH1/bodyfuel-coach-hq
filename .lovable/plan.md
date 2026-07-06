
# Organization Operating Loop – Umsetzungsplan

Ziel: Der komplette operative Bulls Loop läuft ohne Performance Profile. 12 Teilbereiche, in einer Phase umgesetzt. Keine Migration von `performance_points` / `user_points` in Organization Ranking.

---

## 1. Automatische Task Engine (`/api/public/hooks/org-task-engine`)

- Neue TanStack Server Route unter `src/routes/api/public/hooks/org-task-engine.ts`.
- Auth per `apikey` Header (Supabase Anon Key), wie in Cron-Doku.
- Iteriert alle Organizations. Fehler einer Org bricht die Schleife NICHT ab (try/catch pro Org).
- Ruft bestehende `runOrgTaskEngine` Logik pro Org auf.
- Schreibt pro Lauf einen Eintrag in `organization_activity_log`:
  - `event_type = 'task_engine_run'`
  - `metadata` mit `started_at`, `completed_at`, `created_task_count`, `skipped_duplicate_count`, `error_count`, `error_details[]`
- pg_cron Job: täglich 03:00 UTC → HTTP POST auf die Route.
- Bestehender Coach Button bleibt, wird umbenannt zu **"TASKS JETZT SYNCHRONISIEREN"** (manueller Fallback).
- Idempotenz (UNIQUE Index + upsert) unverändert.

## 2. Team Training Schedule editierbar

- Coach Tab **Training → Team Training Schedule**:
  - Pro Team Liste der Schedule-Zeilen: Wochentag, Titel, Start, Ende, aktiv.
  - Zeilen bearbeiten / hinzufügen / deaktivieren.
- Aktuelle Bulls Seniors Konfig (Di/Fr 19:30–21:30) bleibt bestehen, ist aber editierbar.
- Task Engine synchronisiert bei nächstem Lauf:
  - **Historische / abgeschlossene** Tasks (`status IN ('completed','skipped')` oder `scheduled_for < today`) NICHT überschreiben.
  - **Zukünftige** auto-generierte `team_training` Tasks ohne Athlete Interaction (`status = 'pending'`, keine Completion) dürfen aktualisiert / gelöscht werden.

## 3. Athletic Plan Composer

Neue Coach UI im Tab **Training → Athletic Plans** mit Sektionen Aktiv / Entwürfe / Archiv.

### Schema-Erweiterung
- `organization_athletic_plans` erweitern falls nötig: `sport`, `team_id`, `position`, `focus_areas jsonb`, `end_date`, `status` (draft/active/archived).
- **Neu**: `organization_athletic_plan_sessions` (session_name, description, estimated_duration_minutes, scheduled_weekdays jsonb, focus_areas jsonb, order_index).
- **Neu**: `organization_athletic_plan_exercises` (session_id, exercise_id → `coach_exercise_library`, order_index, sets, reps, duration_seconds, rest_seconds, intensity_target, rir, tempo, notes).
- **Neu**: `organization_athletic_plan_assignments` mit `scope_type` in ('organization','team','position','athlete'), `scope_ref` (team_id / position / user_id), `plan_id`, `active`.
- Bestehende `coach_exercise_library` erweitern um `exercise_type` (strength/power/plyometric/sprint/agility/conditioning/mobility/recovery/other). Bestehende Übungen unverändert.

### UI
- Plan-Editor mit Basisdaten + Session Composer + Exercise Picker (aus erweiterter Library, mit "Drill anlegen" Shortcut).
- Assignment-Dialog mit Scope-Auswahl.
- Athletenliste zeigt aktiven Plan + **Quelle des Assignments** (`ATHLETE > POSITION > TEAM > ORGANIZATION`). Konflikte werden explizit angezeigt, keine stille Überschreibung.

## 4. Athletic Task Generation

- Task Engine liest aktive Pläne (Datum in Range) → resolved Assignment pro User (Prio-Reihenfolge).
- Erzeugt `athletic_training` Tasks pro Session/Weekday: `source_type='athletic_plan_session'`, `source_id=session_id`, `metadata.plan_id`.
- Synchronisierung analog Team Training: nur pending / zukünftige Tasks anpassen.
- Neue Athlete Route: `/$orgSlug/athletic/$sessionId` → Session Detail mit Exercises, Fortschritt, "Session abschließen".
- Completion schreibt ausschließlich in Organization-Tabellen (`organization_athletic_session_completions`, neu). Keine persönliche `training_session`.

## 5. Challenge Composer

Coach Tab **Challenges** mit Aktiv / Geplant / Abgeschlossen.

### Schema
- `organization_challenges` erweitern: `team_id`, `visibility_scope`, `status`.
- **Neu**: `organization_challenge_rules` (challenge_id, rule_type, title, description, points, frequency ('daily'|'per_completion'|'once'|'weekly'), max_per_day, max_total, config jsonb).

### UI
- Challenge-Editor mit Rule-Builder für alle Rule-Types (daily_task, daily_checkin, training_completed, athletic_training_completed, team_training_attendance, hydration, nutrition, recovery, manual_bonus, custom).

## 6. Challenge Point Ledger

- **Neu**: `organization_challenge_point_events` (organization_id, challenge_id, user_id, rule_id, source_type, source_id, points, event_date, metadata, created_at, created_by).
- UNIQUE `(challenge_id, user_id, rule_id, source_type, source_id, event_date)` verhindert Doppelvergabe für automatische Events.
- Manual Bonus: `source_type='manual_bonus'`, `created_by=coach_user_id`, kein UNIQUE-Konflikt (source_id = uuid).
- Task-Completion / Check-in Trigger vergibt Punkte gemäß aktiven Challenge Rules → schreibt in Ledger.
- `organization_challenge_progress` bleibt als aggregierter View / cached total (Aggregation aus Ledger).

## 7. Organization Ranking

- `/$orgSlug/ranking` liest aktive Challenge → Aggregat aus Point Ledger, sortiert desc.
- Keine aktive Challenge → Empty State "Aktuell läuft keine Team-Challenge." + optional Liste abgeschlossener Challenges.
- **Kein** Fallback auf globale `user_points`.

## 8. Organization Community Board

### Schema
- **Neu**: `organization_community_posts` (organization_id, team_id, author_user_id, author_role_snapshot, post_type, content, status, created_at, updated_at).
- RLS: nur Mitglieder der Organization dürfen lesen; Athlete-Post-Create nur wenn `organization_settings.allow_athlete_posts` (bestehend / neu als Feature-Flag).
- Staff mit Permission darf moderieren.

### UI
- `/$orgSlug/community` ersetzt Placeholder: Feed, "Neuer Post" Modal mit post_type Auswahl.

## 9. Organization Daily Check-in Context

- Prüfen: bestehende Daily Check Route/Table (`daily_checks`).
- Erweitern (nicht neu bauen) um `organization_id`, `team_id`, `source_task_id` (nullable, kein Breaking Change für persönliche Check-ins).
- RLS für Org-Scope ergänzen.
- Wenn `/daily-check` aus Org-Task geöffnet wird (`?org=<slug>&task=<id>`), wird Context gespeichert und nach Abschluss der zugehörige `organization_task` auf `completed` gesetzt + Challenge Point Event (falls Rule `daily_checkin`).
- Kein Readiness-Score, nur Kontext-Persistierung.

## 10. Staff Management

- Nutzt bestehende `staff_assignments` (kein Duplikat).
- Coach Tab **Staff**: Liste + "+ STAFF HINZUFÜGEN" Modal.
- Flow: E-Mail Suche → falls User existiert direkte Zuweisung, sonst Invite via `organization_invites`.
- Rollen-Presets als Frontend-Konstante (ORGANIZATION_ADMIN, TEAM_COACH, PERFORMANCE_COACH, NUTRITION_COACH, COMMUNITY_MANAGER, CUSTOM), setzen Permission-Vorschläge in JSON.
- Permissions einzeln editierbar.
- RLS + serverseitige `has_org_permission()` Checks (bestehend prüfen, ggf. ergänzen).
- Super Admin (Manuel) bleibt via `user_roles` → `has_role(_, 'admin')` unabhängig.

## 11. Onboarding Testability

- `derived_complete` Logik bleibt.
- Coach-Athletenliste zeigt pro offenem User die **konkret fehlenden Felder** (bereits vorhanden — verifizieren / ausbauen).
- Keine Daten für Cedric, Charon, Lars, Lukas, Mirko, Nassim erfinden.

## 12. Kein Performance Profile

- Keine Scores, Tests, Radar Charts, Score-Berechnung in dieser Phase.

---

## Technische Reihenfolge

1. **Migration** (Schemas 3, 5, 6, 8, 9 + `coach_exercise_library.exercise_type`).
2. **Server Route** `/api/public/hooks/org-task-engine` + pg_cron.
3. **Task Engine erweitern**: Athletic Sessions, Team Schedule Sync-Regeln, Activity Log, Challenge Point Events beim Task-Complete.
4. **Coach UI**: Training-Tab (Schedule + Athletic Plans), Challenges-Tab, Staff-Tab.
5. **Athlete UI**: `/$orgSlug/athletic/$sessionId`, `/$orgSlug/community`, `/$orgSlug/ranking` (aus Ledger), Daily Check-in Context.
6. **Coach Button umbenennen**: "TASKS JETZT SYNCHRONISIEREN".

## Nicht angefasst

`performance_points`, `user_points`, persönliche `training_session`, Smart / Coaching / Nutrition / Weekly-Checkin Logik.

## Abschlussbericht

Nach Umsetzung Doku (`docs/bulls-organization-loop.md`) mit den 13 geforderten Punkten.

---

**Bitte Plan bestätigen.** Danach lege ich die Migration an (großes SQL-File mit allen neuen Tabellen + GRANTs + RLS Policies + `coach_exercise_library` Erweiterung) und fahre dann mit Route, Engine-Ausbau und UI fort.
