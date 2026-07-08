# Trainingsplaner-Erweiterung im Bulls Coach Hub

## Ziel
Coach plant WAS trainiert wird (Team-Fokus pro Tag). BodyFuel Performance generiert daraus WIE
der einzelne Athlet je nach Position/Belastung trainiert. Vorlagen beschleunigen den Wochen-Workflow.

## Scope (was sich ändert)
1. Bestehender Platzhalter „Athletic Plans" in `coach.teams.$orgId.tsx` (Zeile 666-668) wird entfernt.
   Kein separater Athletic-Plan-Composer mehr.
2. `CoachTeamWeekPlanner` wird um Fokus-Feld, Vorlagen-Menü und Live-Fokus-Erkennung erweitert.
3. Neuer Athleten-Session-Generator, der beim Publish aus jeder aktiven Session mit erkanntem
   Athletikfokus (nicht `football`, nicht `none`) einen individuellen Trainingsplan für jeden
   Team-Athleten erzeugt — positions- und belastungsabhängig.
4. Spieler-UI: Bulls Training-Route zeigt für erkannten Fokus die generierte Session (Übungen,
   Sätze/Dauer, Häkchen-Tracking, Session-Complete).

## Datenmodell (Migration)

### `org_training_session_template`
Coach-/organisationsgebundene Vorlagen.
- `id uuid PK`, `organization_id uuid NOT NULL`, `created_by uuid NOT NULL` (auth.users)
- `name text NOT NULL`, `title text NOT NULL`, `focus text NOT NULL`
  (enum-Text: `football|strength|speed|agility|conditioning|mobility|recovery|none`)
- `duration_min int NULL`, `start_time time NULL`, `end_time time NULL`
- `description text NULL`, `notes text NULL`
- `created_at`, `updated_at`
- RLS: SELECT/INSERT/UPDATE/DELETE für org-Coaches/Staff mit Team-Scope-Berechtigung.
  Löschen einer Vorlage berührt keine `org_team_training_week_session` — die sind eigenständige
  Kopien.

### `org_team_training_week_session` (Erweiterung der bestehenden Tabelle)
- neue Spalte `focus text NULL DEFAULT NULL` — vom Coach gesetzt oder vom Erkenner vorbelegt
- neue Spalte `focus_source text NULL` (`auto` | `manual` | `none`)
- neue Spalte `description text NULL` (bisher nur `title`)

### `athlete_training_session`
Individueller, automatisch erzeugter Trainingsplan pro Athlet und Datum, abgeleitet aus einer
Coach-Session.
- `id uuid PK`
- `user_id uuid NOT NULL`, `organization_id uuid NOT NULL`, `team_id uuid NOT NULL`
- `session_date date NOT NULL`
- `source_week_session_id uuid NOT NULL FK org_team_training_week_session ON DELETE CASCADE`
- `focus text NOT NULL`, `title text NOT NULL`
- `position_code text NULL` (Snapshot der Athletenposition zum Publish-Zeitpunkt)
- `duration_min int NULL`
- `exercises jsonb NOT NULL` — Array `[{ id, name, category, sets, reps, duration_sec, notes }]`
- `status text NOT NULL DEFAULT 'scheduled'` (`scheduled|in_progress|completed|skipped`)
- `progress jsonb NOT NULL DEFAULT '{}'::jsonb` — pro Übungs-ID `{ done: bool, done_at: ts }`
- `completed_at ts NULL`
- `created_at`, `updated_at`
- UNIQUE `(user_id, session_date, source_week_session_id)`
- RLS:
  - Athlet: SELECT/UPDATE eigener Zeilen (`user_id = auth.uid()`), Update nur `status`/`progress`/`completed_at`
    per Trigger-Guard.
  - Coach/Staff: SELECT alle Zeilen im eigenen `resolveCoachTeamScope`.
  - Service-Role: ALL (für den Publish-Sync).

GRANTs: `authenticated` erhält SELECT/INSERT/UPDATE/DELETE auf beide neuen Tabellen,
`service_role` ALL. Die Insert/Delete-Rechte der Athleten werden ausschließlich per RLS-Policy
verweigert (keine Insert-Policy für Athleten auf `athlete_training_session`).

## Server-Funktionen (`src/lib/organizations/training-templates.functions.ts`)
- `listTrainingTemplates({ organization_id })` — mit Team-Scope-Check
- `createTrainingTemplate({ organization_id, name, title, focus, duration_min?, description? })`
- `updateTrainingTemplate({ id, patch })` (Umbenennen/Bearbeiten)
- `duplicateTrainingTemplate({ id })`
- `deleteTrainingTemplate({ id })` — beeinflusst keine bereits veröffentlichten Sessions
- Alle mit `requireSupabaseAuth` und Rechteprüfung (Org-Coach/Staff, `resolveCoachTeamScope`).

## Fokus-Erkennung (`src/lib/training-focus-detection.ts`)
Reine Client-/Server-safe Utility.
- `detectTrainingFocus(title: string, description?: string): { focus, confidence, matched }`
- Wörterbuch pro Fokus (deutsch + englisch, Synonyme, Substring-basiert, case-insensitiv):
  - mobility: mobility, mobilität, beweglichkeit, mobilisier*, stretch*, hüfte mobil*
  - strength: kraft, strength, gym, gewichte, lift, squat, deadlift, bankdrücken, hantel
  - speed: speed, schnelligkeit, sprint, acceleration, beschleunigung
  - agility: agility, cod, change of direction, richtungswechsel, footwork
  - conditioning: conditioning, ausdauer, cardio, intervall, hiit, gassers, tempos
  - recovery: recovery, regeneration, active recovery, deload, walk, sauna, foam roll
  - football: football, team training, practice, position drill, playbook, offense, defense, special teams
- Priorisierung: exakter Match > Substring > null (`none`).
- Live-Ergebnis wird im Planner unter dem Titelfeld angezeigt („Erkannter Fokus: MOBILITY").
- Coach kann per Dropdown übersteuern → setzt `focus_source = 'manual'`.

## Athleten-Session-Generator (`src/lib/organizations/athlete-training-session-generator.server.ts`)
Wird beim `publishTeamTrainingWeek` in der bestehenden `task-engine.server.ts` aufgerufen.
Für jede aktive Session der Woche:
- Wenn `focus IN ('football','none', NULL)` → nur bestehende Team-Training-Task (unverändert). Keine Athleten-Session.
- Sonst: für jeden Athleten im Team
  1. Position aus `profiles` / `bulls_profiles` lesen → `positionGroup()` mapping wiederverwenden.
  2. Wochenbelastung ermitteln: Summe der geplanten Sessions Mo–So aus `org_team_training_week_session`
     + bestehende Athletentasks → Kontext für Volumen (leichter/normal/schwer).
  3. Über die vorhandene BodyFuel-Smart-Trainingslogik eine `exercises`-Liste generieren:
     - Wiederverwendung von `coach_exercise_library` als Übungspool, gefiltert nach:
       - Kategorie ~ Fokus (Mapping-Tabelle: mobility → hip/thoracic/ankle; strength → position-spezifisch, usw.)
       - Positionsgruppe (OL: Hüfte/Sprunggelenk/Adduktoren-Bias, WR: Hamstrings/Hüfte/Sprunggelenk,
         QB: Schulter/T-Spine/Hüfte, DL/DB/LB analog aus Bulls-Profile)
     - Dauer entspricht Coach-Session (`end - start` oder 45min Default).
     - Deterministischer Seed pro `(user_id, session_date, focus)` damit Re-Publish stabil bleibt.
  4. Upsert auf `athlete_training_session` per `source_week_session_id`. Bereits `completed`
     Sessions werden nicht überschrieben (Guard im Server: nur `status='scheduled'` überschreiben).

## Coach-UI (`CoachTeamWeekPlanner.tsx`)
- Session-Editor bekommt:
  - Titel + optional Beschreibung
  - Zeitfelder wie bisher
  - Fokus-Anzeige (auto-detected) + Dropdown zum Übersteuern (inkl. „Kein automatischer Athletikplan")
  - Buttons: „+ Neue Einheit" / „Aus Vorlage" (öffnet Dropdown mit Vorlagen der Org)
  - „Als Vorlage speichern" pro aktiver Session
- Neuer Bereich unter Wochenplaner: „Meine Vorlagen" mit Liste, Rename/Duplicate/Delete.
- Erkennungshinweis-Panel: „BodyFuel Performance erstellt für die Spieler positions- und
  belastungsabhängige Sessions." + Button „Spieler-Vorschau" (öffnet Modal mit 3 Beispiel-Positionen).
- Publish-Button-Text bleibt; nach Publish Toast: „Wochenplan veröffentlicht — X Athleten mit
  automatischen Athletik-Sessions."

## Spieler-UI
- Route: `bulls.training.tsx` bekommt einen neuen Abschnitt „Athletik heute" oberhalb bestehender
  Inhalte, wenn für heute eine `athlete_training_session` existiert.
- Komponente `BullsAthleteAthleticSession`: Kopfzeile (Fokus, Dauer, Position-Hinweis), Übungsliste
  mit Sätze/Dauer, Häkchen pro Übung (Update `progress`), Button „Session abschließen"
  (`status='completed'`, `completed_at=now()`).
- Historischer Zugriff (frühere Tage) über kompakte Datums-Chips.

## Aufräumen
- Import- und Referenzen zu `listOrgAthleticPlans`, `createOrgAthleticPlan`,
  `updateOrgAthleticPlanStatus` in `coach.teams.$orgId.tsx` entfernen (Modul bleibt bestehen, wird
  nur nicht mehr aus der Team-Übersicht angesteuert — kein Datenbank-Cleanup, um Bestandsdaten
  nicht zu gefährden).
- Kein Löschen von `organization_athletic_plans*`-Tabellen (Legacy bleibt liegen).

## Nicht im Scope
- Athletic-Plan-Composer (Legacy) wird nicht ersetzt oder neu gebaut, nur der Platzhalter entfernt.
- Keine Änderung an Ernährungsplänen.
- Kein neuer Coach-Rollentyp; Rechte laufen weiter über `resolveCoachTeamScope`.
- Keine Migration alter `org_team_training_schedule`-Daten.

## Tests / Verifikation
1. Coach erstellt Session „Team Mobility 18:00–18:45" → Fokus wird als MOBILITY erkannt →
   Publish → für jeden Athleten wird eine positionsspezifische Mobility-Session mit passenden
   Übungen (QB: Schulter/T-Spine/Hüfte, OL: Hüfte/Sprunggelenk/Adduktoren, WR:
   Hamstrings/Hüfte/Sprunggelenk) angelegt.
2. Coach speichert Session als Vorlage „Gameday Recovery" → Vorlage erscheint in Liste →
   in andere Woche laden → Werte übernommen, Vorlage unverändert.
3. Coach löscht Vorlage → bereits veröffentlichte Athletensessions bleiben unberührt.
4. Coach übersteuert Fokus manuell auf „Kein automatischer Athletikplan" → beim Publish
   werden nur die Team-Training-Task-Einträge erstellt, keine `athlete_training_session`.
5. Coach re-publisht Woche → laufende / abgeschlossene Athletensessions werden nicht
   überschrieben, nur `scheduled`-Zeilen aktualisiert.

## Rückfrage vor Umsetzung
- Übungspool: Ist `coach_exercise_library` als primärer Pool ok, oder soll ein separater
  „Bulls Smart Exercise Catalog" mit positions-gemappten Übungen aufgebaut werden? Falls ja,
  brauche ich einen Seed (JSON) — sonst starte ich mit `coach_exercise_library` +
  Bulls-Position-Bias aus `football-bulls.ts`.
