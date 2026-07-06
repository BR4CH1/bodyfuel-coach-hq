
# Bulls Athlete Flow — Proof of Concept für generisches Organization System

Analyse-Ergebnis (Ist-Zustand):
- `organizations`: Coesfeld Bulls existiert (`slug=bulls`)
- `organization_teams`: 1 Team `Seniors`
- `organization_memberships`: 10 Athleten bereits als `athlete` gebacktfillt (4 mit `onboarding_completed=true`, 6 mit `false`)
- `bulls_profiles`: 1 Datensatz mit `position`, `main_goal`, `weight_kg`, `height_cm`
- `bulls_weight_logs`: 1 Datensatz — noch NICHT an Organizations gebunden
- Legacy `user_groups.group_name='bulls'` → 10 User, deckungsgleich mit Memberships
- Alle Kernstrukturen (Brand Provider, `$orgSlug` Routen, Coach Teams Dashboard) stehen bereits

## Umsetzungsplan

### 1. Datenmodell-Erweiterungen (1 Migration)
Neue generische Tabellen (organization-scoped, RLS aktiv, GRANTs gesetzt):

- `organization_tasks` — generische Tages-Aufgaben pro Athlet
  Felder: `organization_id`, `team_id?`, `user_id`, `task_type` (text — z.B. `team_training`, `athletic_training`, `daily_checkin`, `challenge`, `recovery`, `hydration`), `title`, `subtitle?`, `scheduled_for` (timestamptz), `duration_min?`, `status` (`open|done|skipped`), `link_target?`, `payload jsonb`
- `organization_challenges` — Challenges pro Org/Team
  Felder: `organization_id`, `team_id?`, `name`, `description?`, `starts_at`, `ends_at`, `status`, `config jsonb`
- `organization_challenge_progress` — Punkte pro User pro Challenge
  Felder: `challenge_id`, `user_id`, `points`, `updated_at`
- `organization_activity_log` — für "Letzte Organization Aktivitäten"
  Felder: `organization_id`, `user_id`, `event_type`, `payload jsonb`
- `organization_athletic_plans` — getrennt vom persönlichen Trainingsplan
  Felder: `organization_id`, `team_id?`, `user_id`, `name`, `focus_areas text[]`, `week_start date`, `payload jsonb`, `status`
- Erweiterung `team_memberships`: Spalten `primary_position`, `secondary_position`, `jersey_number`, `gym_access`, `available_training_days int[]`, `limitations text`, `personal_goal` — nur ergänzen, bestehende Struktur nicht umbauen.

RLS-Policies verwenden neue Helper `is_org_member(uuid)` / `is_org_staff(uuid)` (existieren bereits).

### 2. Server Functions (`src/lib/organizations/*.functions.ts`)
- `getOrgHomeData({ slug })` — Membership + Team + Tasks heute + Status-Cards + aktive Challenge
- `getOrgTasks({ slug, range })` / `completeOrgTask({ taskId })`
- `getOrgAthleticTraining({ slug })` — Plan, Woche, Position, Focus Areas
- `getOrgRanking({ slug, teamId? })` — Team Rank aus `organization_challenge_progress` + `performance_points`
- `completeOrganizationOnboarding` (existiert) → erweitern um team_membership upsert mit neuen Feldern
- Coach: `getOrgDetail({ orgId })`, `listOrgAthletes({ orgId })`
- Alle `.middleware([requireSupabaseAuth])`; alle mit Membership-Check (403 wenn kein Zugriff).

### 3. Routen & UI
Athlete Organization Flow (bereits vorhandene `$orgSlug` Routen erweitern/befüllen):
- `$orgSlug.home.tsx` → **BullsAthleteHome** Komponente (generisch, org-driven Branding)
  Sections: Header, HEUTE, DEIN STATUS (4 Cards, feature-gated), NÄCHSTE AUFGABEN, AKTIVE CHALLENGE
- `$orgSlug.training.tsx` → Athletiktraining Startseite (HEUTE, DEIN PLAN, DIESE WOCHE, POSITION, FOKUS)
- `$orgSlug.ranking.tsx` → Team-Ranking (feature-gated)
- `$orgSlug.community.tsx` → Placeholder (feature-gated, "coming soon")
- `$orgSlug.profil.tsx` → Membership/Team Daten + Link zu persönlichem BodyFuel
- `$orgSlug.onboarding.tsx` → erweitertes Onboarding mit Team/Position/Jersey/Gym/Days/Limitations/Goal (existierende Datei überarbeiten; überspringt Name/Größe/Gewicht falls bereits vorhanden)

Layout-Komponenten:
- `OrgAthleteLayout` — Bottom-Nav dynamisch aus `organization_features`
- `OrganizationContextSwitcher` — im bestehenden AppLayout Sidebar/Header; zeigt "MEIN BODYFUEL" + alle Memberships; persistiert `activeContext` in `localStorage`
- Direktaufruf `/bulls` → setzt Context = bulls; normales Dashboard-Öffnen ändert Context NICHT automatisch

Coach Dashboard:
- `coach.teams.$orgId.tsx` erweitern: Header (Name, Type, Status), 4 Cards (Athleten/Staff/Teams/Weekly Compliance), Sektionen (Aktuelle Challenge, Offene Onboardings, Aktivitäten), Tabs feature-gated (Übersicht/Athleten/Teams/Training/Challenges/Ranking/Community/Staff/Einstellungen)
- Athleten-Tab: Liste mit Name/Team/Position/Onboarding/Compliance/LastActive; Klick → Detail mit klarer Trennung `PERSONAL BODYFUEL DATA` vs `COESFELD BULLS DATA`

### 4. Migration bestehender Bulls-User
Zusammenfassung dokumentieren, KEINE aggressive Massen-Zuordnung:
- **Bereits sicher migriert**: 10 User via `user_groups='bulls'` → `organization_memberships` (existierender Backfill)
- **`bulls_profiles`** (1 Datensatz): Migrations-Skript, das `position` → `team_memberships.primary_position` und `main_goal` → `personal_goal` überträgt, wenn user_id-Match. Onboarding_completed NICHT automatisch flippen.
- **`bulls_weight_logs`** (1 Datensatz): bleibt vorerst unverändert, Migration deferred (später als organization_activity oder eigene org-scoped Weight-Historie).
- **`bulls_progress_photos`, `bulls_hub_events`**: bleiben unverändert; noch nicht org-gebunden.
- Kein Löschen, kein Überschreiben.

### 5. Features aktivieren
Insert in `organization_features` für Bulls: `home`, `athletic_training`, `ranking`, `challenges`, `community` (community=false zunächst, Rest=true).

## Bewusst NICHT in dieser Phase
- Performance Profile Algorithmus (nur Placeholder-Card)
- Vollständiges Athletic Development Plan-System (nur Startseite)
- Community-Feed-Implementation
- Migration von `bulls_weight_logs`/`bulls_progress_photos` in Organization-Tabellen
- Weitere Organisationen (RWE, SGZ)

## Abschluss-Report nach Umsetzung
Ich liefere am Ende die 7-Punkte-Zusammenfassung wie gefordert.

---

**Umfang**: 1 Migration + ~15 neue/erweiterte Dateien. Bitte Plan bestätigen, dann setze ich um.
