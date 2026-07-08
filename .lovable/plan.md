## Ziel

Team Training Schedule ist bisher ein **globaler wiederkehrender Wochenplan** (`org_team_training_schedule` mit `weekday 0-6`). Jedes Speichern/Synchronisieren schreibt alle Wochen der Zukunft neu und kann laufende Athleten-Pläne überschreiben.

Wir stellen um auf **konkrete Kalenderwochen (Montag–Sonntag)** mit eigenem Datenblock pro `(organization, team, week_start)`. Vorhandene Athletendaten außerhalb des Zielzeitraums werden nie mehr angefasst.

## Datenmodell (Migration)

Neue Tabelle:

```sql
public.org_team_training_week (
  id uuid pk,
  organization_id uuid,
  team_id uuid,
  week_start date,          -- immer Montag
  week_end   date generated, -- week_start + 6
  status text default 'draft',   -- draft | published
  published_at timestamptz,
  published_by uuid,
  created_at, updated_at,
  unique(team_id, week_start)
)

public.org_team_training_week_session (
  id uuid pk,
  week_id uuid fk cascade,
  session_date date,        -- konkreter Kalendertag im Zeitraum
  title text default 'Team Training',
  start_time time,
  end_time time,
  active bool default true,
  unique(week_id, session_date)
)
```

- GRANTs + RLS (SELECT für Team-Mitglieder & Coaches; INSERT/UPDATE/DELETE nur für Coach/Org-Admin via `resolveCoachTeamScope`).
- Bestehende `org_team_training_schedule` bleibt vorerst unangetastet (Legacy-Fallback), wird aber nicht mehr von der UI beschrieben.

## Server-Funktionen (`src/lib/organizations/team-training-week.functions.ts`, neu)

- `listTeamTrainingWeeks({ orgId, teamId, from, to })` — Liste inkl. Status.
- `getTeamTrainingWeek({ orgId, teamId, week_start })` — mit Sessions.
- `upsertTeamTrainingWeek({ orgId, teamId, week_start, sessions })` — Upsert im Zielzeitraum, `status=draft`.
- `publishTeamTrainingWeek({ orgId, teamId, week_start })` — setzt `status=published`, triggert Athletendatens-Sync **ausschließlich für Datumsbereich `week_start..week_end`**.
- Alle nutzen `resolveCoachTeamScope` und lehnen ab, wenn Coach kein Team-Recht hat.

## Task-/Player-Sync (wochenbezogen)

Bestehende `task-engine` wird auf einen zusätzlichen `publishWeeklyTrainingTasks(week_id)`-Pfad umgestellt:

- **Upsert** von Player-Trainingstasks strikt für Datumsbereich der Woche (`gte week_start AND lte week_end`).
- **Kein DELETE** außerhalb dieses Zeitraums.
- Deduplizierung per `(user_id, session_date, source='team_training_week', week_id)`-Key.
- Bestehende Datums-basierte Athleten-Tasks vor `week_start` und nach `week_end` bleiben unberührt.
- Absolvierte Einheiten (`completed_at not null`) werden nie neu geschrieben.

## Day-Type / Smart-Kopplung

`day-type-resolver.functions.ts`:

- Neuer Auflösungspfad: für ein Datum wird zuerst geprüft, ob es in einer **veröffentlichten** `org_team_training_week` eine aktive Session mit `session_date = <Datum>` gibt → `football_training`.
- Fallback bleibt bestehender Weekday-Plan (bis Migration alter Daten abgeschlossen ist).
- Damit hat KW 30 andere Trainingstage als KW 29, ohne KW 29 zu verändern.

## Coach-UI (`src/routes/coach.teams.$orgId.tsx` / neue Komponente `CoachTeamWeekPlanner.tsx`)

Ersetzt den heutigen „Team Training Schedule (Wochenplan)"-Block:

- **Wochenwähler-Header**: `← Vorherige Woche | KW 29 · 13.–19. Jul 2026 | Nächste Woche →`, plus Chips „Aktuelle Woche", „Nächste Woche".
- **Status-Badge**: `Entwurf` / `Veröffentlicht` / `Aktuelle Woche` / `Vergangen`.
- **Kompakte Tageszeilen**: aktive Tage zeigen Titel + Start/Ende, inaktive Tage zeigen nur `+ Training hinzufügen`.
- **CTA in Bulls-Rot**: `Plan für 13.–19. Jul veröffentlichen` (bzw. `Änderungen veröffentlichen`).
- Team-Auswahl respektiert `resolveCoachTeamScope` (nur zugängliche Teams sichtbar).
- Toast nach Publish: „Wochenplan veröffentlicht — jetzt für N Athleten verfügbar".

## Athleten-UI

- Neuer Toggle `Aktuelle Woche` / `Kommende Woche` in `WeekScheduleCard` (Bulls-Variante) und im Bulls Home / Trainingsplan-Bereich, sobald eine veröffentlichte kommende Woche existiert.
- **Standardansicht**: aktuelle Woche bis inkl. Sonntag; ab Montag der Folgewoche wird diese automatisch die aktive Standard-Woche.
- Kommende Woche ist read-only-Preview (kein Tracking-Umschalten).

## Tests / Verifikation

Nach Umsetzung manuell + über SQL:

- Test A: Woche 06.–12.07 existiert, neue 13.–19.07 publish → alte unverändert (SQL check auf `athlete_tasks` Datumsbereich).
- Test B: KW 29 erneut editieren + publish → gleiche `week_id` upserted, keine doppelten Sessions/Tasks (`unique(week_id, session_date)` + Task-Dedupe-Key greifen).
- Test C: Coach mit Team-Bindung Seniors → `listTeamTrainingWeeks` liefert für U19 leer, Publish für U19 wirft 403.

## Nicht im Scope

- Keine Migration alter `org_team_training_schedule`-Daten in die neue Struktur (Fallback im Resolver reicht; Coach legt neue Wochen selbst an).
- Keine Änderung an Ernährungs-Schedules — bleibt weekday-basiert, kann später gleich umgestellt werden.
- Kein Rebuild der Coach-Rollen-Logik oder Positionsgruppen.

## Abschluss-Reporting (nach Umsetzung)

- Speicherort des Zeitraums: `org_team_training_week.week_start/week_end` + Sessions in `org_team_training_week_session.session_date`.
- Duplikatschutz: `unique(team_id, week_start)` und `unique(week_id, session_date)`.
- Schutz laufender Pläne: Publish-Sync filtert `athlete_tasks` strikt auf `[week_start, week_end]`, kein globales DELETE.
- Athleten-Umschaltung: `WeekScheduleCard`-Toggle „Aktuelle / Kommende Woche".

Bitte bestätige den Plan, dann setze ich in einem Zug Migration, Server-Funktionen, Coach-UI, Athleten-Toggle und Day-Type-Resolver um.
