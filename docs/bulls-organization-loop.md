# Bulls Organization Operating Loop — Umsetzungsdoku

Diese Doku beschreibt den operativen Loop des generischen Organization-Systems, wie er für die Coesfeld Bulls als Proof of Concept läuft. Alle Strukturen sind generisch — Bulls ist nur die erste aktive Konfiguration.

## 1. Automatische Task Engine

- **Trigger**: `pg_cron` Job `org-task-engine-daily` läuft täglich um **03:00 UTC**.
- **Endpoint**: `POST /api/public/hooks/org-task-engine` (Datei `src/routes/api/public/hooks/org-task-engine.ts`).
  Auth über den Supabase Anon Key im `apikey` Header.
- **Ablauf**:
  1. Endpoint holt alle aktiven Organizations über den Service-Role Client.
  2. Für jede Org wird `runOrgTaskEngineWithClient(supabase, orgId, horizonDays=14)` aufgerufen (Datei `src/lib/organizations/task-engine.server.ts`).
  3. Fehler pro Org werden gefangen und laufen nicht in den nächsten Org-Aufruf.
- **Idempotenz**: partial UNIQUE Index `uq_org_tasks_source_day` auf `organization_tasks(organization_id, user_id, task_type, source_type, source_id, scheduled_date)`. Upsert nutzt `ignoreDuplicates: true`.
- **Manueller Fallback**: Coach-Button **„Tasks jetzt synchronisieren"** in `coach.teams.$orgId.tsx` → Server Fn `runOrgTaskEngine` (auth-scoped) → nutzt denselben Helper.

## 2. Task Engine Runs Protokollierung

Jeder Lauf schreibt einen Eintrag in `organization_activity_log`:
- `event_type = 'task_engine_run'`
- `payload`:
  - `started_at`
  - `completed_at`
  - `created_task_count`
  - `skipped_duplicate_count`
  - `removed_stale_count`
  - `error_count`
  - `error_details[]`
  - `horizon_days`

## 3. Athletic Plans

Speicherung (alle scoped auf `organization_id`):

| Tabelle | Zweck |
|--------|-------|
| `organization_athletic_plans` | Plan-Header (name, sport, position, team_id, focus_areas, start_date, end_date, status, description). `user_id` ist jetzt optional — Pläne sind Templates, nicht per se an einen User gebunden. |
| `organization_athletic_plan_sessions` | Sessions (session_name, description, estimated_duration_minutes, scheduled_weekdays, focus_areas, order_index). |
| `organization_athletic_plan_exercises` | Übungen pro Session mit Verweis auf `coach_exercise_library.id` sowie sets/reps/duration/rest/intensity/rir/tempo/notes. |
| `organization_athletic_plan_assignments` | Zuweisung mit `scope_type` in `('organization','team','position','athlete')`, plus optional `team_id`, `position`, `athlete_user_id`. |

**Exercise Library erweitert**: `coach_exercise_library.exercise_type` in
`(strength, power, plyometric, sprint, agility, conditioning, mobility, recovery, other)`. Athletische Drills werden über neue Einträge dort abgebildet — keine sportartspezifischen Tabellen.

Server Fns (`src/lib/organizations/operating-loop.functions.ts`):
- `listOrgAthleticPlans`
- `createOrgAthleticPlan`
- `updateOrgAthleticPlanStatus`
- `getOrgAthleticSession`
- `completeOrgAthleticSession`

## 4. Assignment-Priorität

Die Task Engine resolved pro Plan die Ziel-User in dieser Reihenfolge (frühester Match gewinnt):

```
ATHLETE  >  POSITION  >  TEAM  >  ORGANIZATION
```

Konflikte werden nicht still überschrieben — jeder User erhält den Plan über das höchstprior. Assignment, dessen Scope ihn erfasst.

## 5. Organization Athletic Sessions abschließen

- Athlete öffnet Task-Link `/{orgSlug}/athletic/{sessionId}` (Route `$orgSlug.athletic.$sessionId.tsx`).
- UI zeigt Session-Name, Fokus, Dauer, Übungen (aus `coach_exercise_library`), Rating & Notes.
- „Session abschließen" ruft `completeOrgAthleticSession` auf:
  1. Insert in `organization_athletic_session_completions`
  2. Zugehörigen `organization_tasks` Eintrag auf `status='completed'`.
  3. `awardPointsForEvent` schreibt Punkte in Ledger für Rules vom Typ `athletic_training_completed`.
- **Keine** Änderung an persönlichen `training_session` / `training_set_logs`.

## 6. Challenge Rules

`organization_challenge_rules` mit Feldern:
- `rule_type` ∈ `daily_task, daily_checkin, training_completed, athletic_training_completed, team_training_attendance, hydration, nutrition, recovery, manual_bonus, custom`
- `title`, `description`, `points`, `frequency` (`daily|per_completion|once|weekly`), `max_per_day`, `max_total`, `config jsonb`, `active`.

Anlegen im Coach UI (Tab **Challenges → Rules**) über `upsertChallengeRule`.

## 7. Challenge Point Ledger

`organization_challenge_point_events`:
- Felder: `organization_id, challenge_id, user_id, rule_id, source_type, source_id, points, event_date, metadata, created_by, created_at`.
- **Aggregat statt Cache**: `organization_challenge_progress` bleibt bestehen (Legacy), das Ranking aggregiert aber primär aus dem Ledger.
- Manuelle Bonuspunkte: `source_type='manual_bonus'`, `rule_id=null`, `created_by=coach_uid`.

## 8. Doppelte Punkte verhindern

Partial UNIQUE-Index:

```sql
uq_challenge_events_auto
  ON (challenge_id, user_id, rule_id, source_type, source_id, event_date)
  WHERE source_type <> 'manual_bonus'
    AND rule_id IS NOT NULL
    AND source_id IS NOT NULL
```

- Automatische Events (z. B. Session-Abschluss, Daily-Check-Abschluss) landen deterministisch nur einmal pro Kombination.
- Manuelle Boni sind explizit ausgeschlossen und werden nicht dedupliziert.

## 9. /bulls/ranking Verhalten

Route `$orgSlug.ranking.tsx` → Server Fn `getOrgChallengeRanking`:
1. Aktive Challenge suchen (`status='active'`).
2. Aggregat aus `organization_challenge_point_events` bilden.
3. Falls Ledger leer & Legacy `organization_challenge_progress` vorhanden: Fallback-Aggregat aus Legacy-Tabelle (nur für den Übergang; neue Challenges nutzen den Ledger).
4. Keine aktive Challenge → Empty State „Aktuell läuft keine Team-Challenge." plus optional Liste letzter abgeschlossener Challenges.
5. **Nie** Fallback auf globale `user_points`.

## 10. Community Posts RLS

`organization_community_posts`:
- `SELECT` nur für Mitglieder / Staff / Coach der jeweiligen Organization (Status `active`).
- `INSERT` erlaubt für Staff mit `manage_community`, Org-Admin, Coach, oder Athlete-Mitglied bei `post_type='general'` und `organizations.settings.allow_athlete_posts=true` (Default `true`).
- `UPDATE/DELETE` nur eigene Posts oder Staff mit Permission.
- Keine Cross-Organization-Sichtbarkeit.

Athlete-UI: `$orgSlug.community.tsx`. Coach-UI: Tab „Community" im Coach Dashboard.

## 11. Organization Daily Check-in Kontext

- `daily_checks` bekommt drei optionale Felder:
  - `organization_id`, `team_id`, `source_task_id` — alle nullable, keine Auswirkung auf persönliche Check-ins.
- Task Engine setzt in `organization_tasks.link_target` für Check-in Tasks:
  `link_target = /daily-checklist?org=<slug>`.
- Server Fn `attachDailyCheckOrgContext` markiert den existierenden `daily_checks` Row mit Org-Kontext, setzt den `organization_task` auf `completed` und schreibt Challenge-Punkte über Rules `daily_checkin`.
- **Keine** Änderung an persönlicher Check-in Logik oder `daily_checks.tasks` Payload.

## 12. Staff Presets & Permissions

Presets in `STAFF_PRESETS` (Frontend-Konstante):

| Preset | Role | Permissions |
|--------|------|-------------|
| ORGANIZATION_ADMIN | `organization_admin` | view_members, manage_training, manage_challenges, manage_community, manage_staff |
| TEAM_COACH | `coach` | view_members, manage_training |
| PERFORMANCE_COACH | `staff` | view_members, manage_training |
| NUTRITION_COACH | `staff` | view_members |
| COMMUNITY_MANAGER | `staff` | view_members, manage_community |
| CUSTOM | `staff` | (frei) |

Server Fns: `addOrgStaff` (fügt existierenden User zu `staff_assignments` hinzu oder erzeugt `organization_invites` bei E-Mail), `updateOrgStaffPermissions`, `removeOrgStaff`.

RLS auf `staff_assignments`: Nur `has_role('coach')` oder `is_org_admin` dürfen schreiben. Super-Admin Manuel bleibt über `user_roles.role='admin'` (Plattform-weit) unabhängig — kein `staff_assignment` nötig.

## 13. Offene Punkte vor Performance Profile

Damit der Loop vollständig UI-seitig endet und der Weg zum Performance Profile frei ist, verbleiben folgende MVP-Ergänzungen (Server-Fns sind bereits vorhanden — nur die Coach-UI-Composer stehen aus):

1. **Athletic Plan Composer UI** — Editor für Sessions & Exercises inkl. Assignment-Dialog (Server Fns `createOrgAthleticPlan`, Session-/Exercise-/Assignment-Upserts sind vorbereitet; als nächstes braucht der Coach ein Editor-Panel unter Training → Athletic Plans).
2. **Staff-Add-Modal** im Coach UI (Server Fn `addOrgStaff` verfügbar; UI mit E-Mail-Suche + Preset-Dropdown fehlt noch).
3. **Athlete Assignment Anzeige** — sichtbare Quelle des aktiven Plans (`ATHLETE > POSITION > TEAM > ORGANIZATION`) im Athletes-Tab.
4. **Community-Feed Attachments** (Bilder, Reactions) — aktuell nur Text.
5. **Daily-Checklist Route Anpassung**: aktuell wird der org-Task beim ersten Check-in-Insert nicht automatisch geschlossen. Sobald die Athlete-UI `attachDailyCheckOrgContext` aufruft, ist dieser Kreis geschlossen — Wiring in `daily-checklist.tsx` steht aus.
6. **Legacy `organization_challenge_progress` Migration in Ledger** (optional): Aktive Bulls-Challenges haben aktuell keine Progress-Rows, daher unkritisch.
7. **Team-Attendance Feature**: Rule-Type `team_training_attendance` benötigt UI für Coach zum Abhaken (aktuell nur Rule-Definition, kein Event-Ingestor).

Danach folgt das sportartspezifische Performance Profile System.

---

## Referenzdateien

- `src/lib/organizations/task-engine.server.ts` — shared engine core
- `src/lib/organizations/task-engine.functions.ts` — auth-scoped Wrapper + manueller Trigger
- `src/lib/organizations/operating-loop.functions.ts` — Community, Challenges, Rules, Ledger, Athletic Plans, Staff, Daily-Check-Context
- `src/routes/api/public/hooks/org-task-engine.ts` — Cron Endpoint
- `src/routes/$orgSlug.athletic.$sessionId.tsx` — Athlete Session Detail
- `src/routes/$orgSlug.community.tsx` — Community Feed
- `src/routes/$orgSlug.ranking.tsx` — Challenge Ranking
- `src/routes/coach.teams.$orgId.tsx` — Coach Dashboard (Training, Challenges, Community, Staff)
- Migration `20260706-152346-*` — Alle neuen Tabellen / Erweiterungen
- pg_cron Job `org-task-engine-daily` (03:00 UTC täglich)
