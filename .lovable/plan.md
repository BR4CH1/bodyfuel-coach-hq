# Bulls Organization Flow — Audit & Umsetzungsplan

Zuerst ausgeführte Bestandsaufnahme (echte DB-Werte), dann ein umsetzbarer Plan. Vor der Umsetzung bitte einmal absegnen — insbesondere die Legacy-Bewertung in Abschnitt 2/3, da dort das Risiko unerwünschter Datenverschiebungen liegt.

## 1) Audit-Ergebnisse (live aus der DB)

**Bulls-Legacy-Tabellen (Datenbestand):**
- `bulls_profiles` — 4 Zeilen. Felder: `weight_kg, height_cm, position (enum), main_goal (enum), onboarded_at`. → Persönliche Athletendaten + Organization-Onboarding-Daten vermischt.
- `bulls_weight_logs` — 2 Zeilen. Felder: `user_id, log_date, weight_kg`. → **Persönliche BodyFuel-Daten**, nicht Organization-Eigentum.
- `bulls_progress_photos` — 0 Zeilen. → Persönliche Daten.
- `bulls_hub_events` — 13 Zeilen. Felder: `user_id, kind, occurred_at` (z. B. `onboarding_complete`, `nutrition_plan_opened`). → Reine Usage-Events, keine Punkte.

**Vermeintliche "Bulls Challenge Points":**
- Es existiert **keine** dedizierte Bulls-Challenge-/Ranking-Tabelle.
- `performance_points` (96 Zeilen, 5/10 Bulls-User) und `user_points` (18 User global) sind **globale BodyFuel-Smart-Punkte** (`pr_volume, pr_weight, pr_e1rm, strength_check_done, streak_7`). Nicht organisationsbezogen, nicht challenge-basiert.
- `organization_challenges` / `organization_challenge_progress`: 0 / 0 Zeilen. `/bulls/ranking` liest aktuell also weder eine echte Legacy-Ranglistenhistorie noch eine gefüllte neue Tabelle — es gibt schlicht keine "verlorene" Historie.

**Community-Feature:** `organization_features` für Bulls → `community.enabled = false`.
**Onboarding:** 10 Bulls-Mitglieder, davon 6 mit `onboarding_completed = false`.

## 2) Mapping-Doku (kein Move, nur Doku + Bridge)

Als Datei `docs/bulls-legacy-mapping.md` anlegen. Pro Legacy-Objekt: Inhalt, User-Bezug, Klassifikation, Zielmodell, Empfehlung. Zusammenfassung:

| Legacy | Klassifikation | Empfehlung |
|---|---|---|
| `bulls_profiles.weight_kg/height_cm` | Persönlich | Bleibt. Beim Org-Onboarding nur **lesen**, nicht kopieren. Neue Fragen nur wenn `NULL`. |
| `bulls_profiles.position/main_goal/onboarded_at` | Organization | Bridge: beim Onboarding in `team_memberships.position` / `personal_goal` spiegeln, `onboarding_completed=true` setzen, wenn vollständig. Legacy-Tabelle bleibt read-only. |
| `bulls_weight_logs` | **Persönlich** | Nicht in Org-Sichten zeigen. Bleibt als persönliche Gewichtsspur. Coach-Bulls-Ansicht bekommt keinen Zugriff. |
| `bulls_progress_photos` | Persönlich | Bleibt. |
| `bulls_hub_events` | Analytics | Read-only Bridge in `organization_activity_log` (Anzeige-Join zur Laufzeit), keine Kopie. |
| `bulls.*` Legacy-Routen | UI | Bleiben vorerst bestehen; neue Org-Flow läuft parallel unter `/$orgSlug`. Kein Löschen in dieser Phase. |
| `performance_points`, `user_points` | Global (persönlich) | Bleiben persönlich. **Nicht** ins Bulls-Ranking übernehmen. |

**Wichtige Konsequenz:** Es gibt keine "echte Bulls-Challenge-Historie" die verloren gehen könnte. Das neue Org-Challenge-System startet bewusst leer. Der Plan schreibt das im Bericht klar so aus.

## 3) Community aktivieren

- `organization_features` für Bulls: `community.enabled = true` (via insert-Tool, kein Schema-Change).
- Athlete-BottomNav und Coach-Tabs sind bereits feature-gated → werden automatisch sichtbar.
- Keine neue Community-Architektur. `$orgSlug.community.tsx` bleibt Placeholder mit "Community Board folgt" — als Fundament für späteres org-scoped Board. Keine Verknüpfung mit dem bestehenden globalen `/community` Hub (unterschiedliche Scopes).

## 4) Onboarding-Status-Anzeige (Coach → Bulls → Athleten)

- Server-fn `getOrgAthletesOnboarding(orgId)` erweitern: pro Membership berechnen welche **erforderlichen** Felder in `team_memberships` fehlen (`position`, `jersey_number`, `gym_access`, `available_training_days`) sowie `weight_kg/height_cm` aus `bulls_profiles` oder `profiles`.
- Wenn alle erforderlichen Felder gesetzt → `onboarding_completed=true` automatisch backfillen (idempotent, nur `false→true`).
- UI: Liste mit `Name | Status (OFFEN/ABGESCHLOSSEN) | Fehlende Felder`.
- Onboarding-Route (`$orgSlug.onboarding.tsx`): bereits vorhandene Werte vorbelegen, nur fehlende Felder abfragen.

## 5) Task Engine (idempotent)

Neue Server-fn `runOrgTaskEngine({ organizationId, date })`, aufrufbar von Coach-UI und vom Athlete-Home-Loader (heutiger Tag).

Sources → Tasks:
1. **team_training_schedule** (neue Tabelle, siehe unten) → 1 Task pro Team-Mitglied pro geplantem Wochentag.
2. **organization_athletic_plans** (`payload.sessions[]` mit `scheduled_date`) → `athletic_training`-Tasks.
3. **organization_challenges** aktive → `challenge`-Tasks (falls `config.daily=true`).
4. **daily_checkin_enabled** in `organization_features.checkins.config` → `daily_checkin`-Task pro Tag/Athlet (nur konfigurierte Wochentage). Verlinkt auf bestehenden Check-in-Flow, **keine Readiness**.
5. **Manuelle Staff-Tasks** → direkt via Insert erzeugt, nicht regeneriert.

**Idempotenz:** UNIQUE-Index `(organization_id, user_id, task_type, source_type, source_id, scheduled_for::date)` → `ON CONFLICT DO NOTHING`. Nur regenerierbare Sources (1–4) fallen unter Engine; manuelle Tasks (5) haben `source_type='manual'` und bleiben unberührt.

## 6) Neue Tabellen (1 Migration)

- `organization_team_training_schedule (team_id, weekday int, start_time, end_time, title, active, timestamps)` + GRANT + RLS: Staff read/write, Members read.
- `organization_tasks` erweitern: `source_type text`, `source_id uuid`, `points int`, plus o. g. UNIQUE-Index. `link_target` bleibt.
- `organization_features` — Feature-Row `checkins` mit `config jsonb` (`daily_checkin_enabled, checkin_days[], checkin_available_from, checkin_due_time`); Standardwerte für Bulls seedbar.
- Seed (Insert-Tool, kein Schema): Bulls Seniors → Dienstag + Freitag, `title='Team Training'`, `active=true`.

## 7) Coach-Organization-UI (Tabs funktional)

- **Training-Tab**: Team-Training-Schedule-Editor (Wochentage toggeln, Uhrzeit optional). Athletic-Plans-Liste (read + placeholder-Editor "folgt" bleibt für Plan-Composer).
- **Challenges-Tab**: Aktive Challenge (falls vorhanden), Teilnehmerliste + Punktestand aus `organization_challenge_progress`. Historie leer mit klarem Hinweis "Noch keine Challenge-Historie". Kein Rückgriff auf `performance_points`.
- **Tasks-Tab** (neu, in Übersicht): Heutige Tasks der Org, Filter Team + Status, Button "Manuelle Aufgabe anlegen" (Zielgruppe Org/Team/Athlet, Datum, Titel, Typ).
- **Staff-Tab**: Join `staff_assignments` → `profiles.first_name/last_name` (kein E-Mail). Anzeige: Name, Rolle, Org-Scope, Team-Scope.

## 8) Nicht Teil dieser Phase

- Kein Performance Profile, keine Scores (Acceleration/Speed/…).
- Kein Community-Board-Feed.
- Keine destruktive Legacy-Migration.
- Keine Löschung von `bulls.*` Routen.
- Kein Umbau von Smart/Coaching/Nutrition/Persönlichem Training.

## 9) Abschlussbericht (nach Umsetzung)

Ich beantworte die 10 Punkte aus deinem Auftrag inkl. konkreter User-IDs mit offenem Onboarding und den jeweils fehlenden Feldern.

## Technische Deliverables

- 1 Migration: `organization_team_training_schedule` + Erweiterungen `organization_tasks` + Trigger.
- 3 Insert-Ops: Community-Feature aktivieren, Checkins-Feature-Config seeden, Bulls-Seniors-Schedule Di/Fr seeden.
- Server-Fns: `runOrgTaskEngine`, `listOrgTasks`, `createManualOrgTask`, `getOrgAthletesOnboarding`, `upsertTeamTrainingSchedule`, `listOrgStaffWithProfiles`.
- Route-Erweiterungen: `coach.teams.$orgId.tsx` (Training/Challenges/Tasks/Staff), `$orgSlug.home.tsx` (Task-Engine-Aufruf beim Laden), `$orgSlug.onboarding.tsx` (Prefill + Skip vorhandener Felder).
- Docs: `docs/bulls-legacy-mapping.md`.

Freigabe bitte, dann setze ich in dieser Reihenfolge um: Migration → Feature-Flags → Task Engine + Schedule → Coach-UI-Tabs → Onboarding-Prefill → Bericht.
