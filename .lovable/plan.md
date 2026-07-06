
# Multi-Organization Grundlage für BodyFuel

Ziel: generisches, skalierbares Org-System. Bestehende Accounts, Rollen, Smart-/Coaching-Logik und `bulls_*` Daten bleiben unangetastet. Bulls wird schrittweise als erste Organisation abgebildet — aber nicht hart verdrahtet.

Dieser Plan liefert **Fundament + Routing + Coach-Menü + Bulls als erste Org (Datenmigration light)**. Feature-Module (Ranking pro Org, Challenges pro Org, Community pro Org) sind Folge-Iterationen und explizit **nicht** Teil dieses Plans.

---

## 1. Datenbank (eine Migration)

Neue Tabellen im `public` Schema, alle mit RLS + GRANTs:

- `organizations` — `id, name, slug (unique, lower, regex), organization_type enum, logo_url, primary_color, secondary_color, status enum(active|inactive|archived), created_at, updated_at`
- `organization_teams` — `id, organization_id, name, slug, sport, age_group, status, created_at, updated_at`, unique `(organization_id, slug)`
- `organization_memberships` — `id, user_id, organization_id, role enum(athlete|member|staff|coach|organization_admin), status enum(active|invited|inactive|removed), onboarding_completed bool, joined_at, created_at, updated_at`, unique `(user_id, organization_id)`
- `team_memberships` — `id, user_id, team_id, position, secondary_position, jersey_number, status, created_at, updated_at`, unique `(user_id, team_id)`
- `organization_invites` — `id, organization_id, team_id nullable, email nullable, assigned_role, invite_token (unique), expires_at, status enum(pending|accepted|expired|revoked), created_by, created_at`
- `staff_assignments` — `id, user_id, organization_id, team_id nullable, role, permissions text[], created_at, updated_at`, unique `(user_id, organization_id, team_id)`
- `organization_features` — `id, organization_id, feature text, enabled bool, config jsonb`, unique `(organization_id, feature)`

Enums als eigene Postgres `type`s.

**Reserved slugs**: Trigger auf `organizations` verbietet Slugs, die bestehende Top-Level-Routen kollidieren würden (`auth`, `login`, `dashboard`, `nutrition`, `training`, `messages`, `community`, `profile`, `coach`, `admin`, `tracker`, `smart`, `bulls` bleibt frei für Migration, `ranking`, `achievements`, `checkout`, `impressum`, `datenschutz`, `trust`, `welcome`, `api`, `app`, `mcp`, `lovable`, `well-known`, `onboarding`, `measurements`, `progress`, `strength-check`, `check-in`, `training-import`, `daily-checklist`, `unsubscribe`, `guardian-consent`).

**Security-Definer Helpers** (analog `has_role`):
- `is_org_member(_user uuid, _org uuid) returns bool`
- `is_org_staff(_user uuid, _org uuid, _permission text default null) returns bool`
- `is_org_admin(_user uuid, _org uuid) returns bool` (super_admin via `has_role('coach')` inklusive)

**RLS**:
- `organizations`: SELECT für alle Mitglieder + Staff + `has_role('coach')`. Nur `has_role('coach')` oder org_admin managen.
- `organization_teams`: SELECT wenn Org-Mitglied/Staff. Manage: org_admin/staff mit `manage_organization`.
- `organization_memberships`: SELECT eigene Zeile ODER Staff/Admin derselben Org. Manage: org_admin, Staff mit `manage_members`, `has_role('coach')`.
- `team_memberships`: analog, gescoped über Team → Org.
- `organization_invites`: SELECT Staff der Org. Insert Staff mit `manage_members`. Öffentlich einlösbar über Server-Function `redeemInvite` (kein direkter Client-Select über Token).
- `staff_assignments`: SELECT eigene + org_admin. Manage: org_admin, `has_role('coach')`.
- `organization_features`: SELECT alle Mitglieder derselben Org; Manage org_admin.

Kein Löschen/Überschreiben bestehender Tabellen. Keine `is_*_user` Booleans.

## 2. Bulls als erste Organisation (Daten-Bootstrap, nicht-destruktiv)

In derselben Migration:
- Row in `organizations` einfügen (`slug='bulls'`, `organization_type='sports_club'`, Farben aus bestehendem Bulls-Theme).
- Ein `organization_teams` Row `Seniors`.
- Backfill: für jeden User mit `user_groups.group_name='bulls'` → `organization_memberships (role='athlete', status='active', onboarding_completed = EXISTS(bulls_profiles))`.
- Features aktivieren, die die Bulls-Seiten heute nutzen.
- `user_groups` und `bulls_*` Tabellen bleiben **unverändert und aktiv** — die neuen Tabellen laufen parallel. Migration der Bulls-Routen auf das generische System erfolgt in einer Folge-Iteration.

## 3. Routing (`/:orgSlug`)

Neue TanStack-Routen:
- `src/routes/org.$slug.tsx` — Layout mit `beforeLoad`: lädt Org via Server-Fn `getOrganizationBySlug` (publishable client, `status='active'`, safe columns). 404 → notFound.
- `src/routes/org.$slug.index.tsx` — Login/Membership/Onboarding/Home-Weiche im Component (kein `_authenticated`-Wrap, weil unauth Landing gezeigt werden muss).

Ablauf im Component:
1. Nicht eingeloggt → gebrandete Login-/Signup-Karte, danach zurück auf `/:slug`.
2. Eingeloggt + keine `organization_membership` → geschützte Access-Seite („Kein Zugriff — bitte Einladungslink anfordern").
3. Membership vorhanden + `onboarding_completed=false` → Redirect `/:slug/onboarding`.
4. Fertig → Redirect `/:slug/home`.

Weitere Routen als Stubs (leere Layouts mit Feature-Gate):
- `org.$slug.onboarding.tsx`
- `org.$slug.home.tsx`
- `org.$slug.invite.$token.tsx` — ruft `acceptOrganizationInvite` Server-Fn auf.

Bestehende Top-Level-Routen bleiben; Slug-Kollision wird DB-seitig verhindert.

## 4. Server Functions (`src/lib/organizations/*.functions.ts`)

- `getOrganizationBySlug({ slug })` — public read (server publishable client).
- `getMyOrganizations()` — auth, listet Memberships + Org-Kern + Features.
- `getOrganizationContext({ slug })` — auth, gibt Membership + Team + Features + Permissions.
- `createOrganizationInvite(...)` — auth, staff-only.
- `acceptOrganizationInvite({ token })` — auth, erstellt `organization_memberships` + ggf. `team_memberships`, markiert Invite `accepted`.
- `listOrganizationsForCoach()` — auth, `has_role('coach')`.

Alle mit `requireSupabaseAuth` (außer `getOrganizationBySlug`).

## 5. Context Switcher

- `src/lib/organizations/context.tsx` — `OrganizationProvider` mit aktuellem Org-Slug (aus Route-Match) + `useOrganizationContext()`.
- Kleiner Switcher in `AppLayout` (Desktop-Sidebar + Mobile-Top): zeigt "Mein BodyFuel" + jede aktive Membership. Klick navigiert zu `/:slug/home` bzw. `/dashboard`.
- Branding (primary/secondary color, Logo) via CSS-Variablen im Org-Layout, keine harten Themes.

## 6. Coach Dashboard — Teams Menü

- Neuer Nav-Eintrag `Teams` in `coachNav`.
- Route `src/routes/coach.teams.tsx` (Übersicht) + `src/routes/coach.teams.$orgId.tsx` (Org-Admin-Seite mit Tabs: Übersicht, Mitglieder, Teams, Staff, Einstellungen; weitere Tabs Feature-gated und im ersten Schritt als Placeholder-Panels).
- Liste dynamisch via `listOrganizationsForCoach`, keine hardcoded Namen.
- Sichtbarkeit über `staff_assignments` + `has_role('coach')` (super admin).

## 7. Existing-User Add-on Onboarding (Rahmen)

- `org.$slug.onboarding.tsx` liest bestehende `profiles`/`body_measurements` und fragt nur fehlende + org-spezifische Felder (Position, Team, Jersey, Gym-Setup, Einschränkungen) ab. Speichert in `team_memberships` + optionalem `organization_member_profiles` jsonb-Feld (kommt in Folge-Iteration falls nötig — Bulls nutzt weiter `bulls_profiles`, bis Migration greift).
- Setzt `organization_memberships.onboarding_completed=true`.

Konkrete Formularfelder pro Org sind Folge-Iteration; im ersten Wurf: Position + Team + Jersey Number als generische Felder.

## 8. Nicht in diesem Schritt

- Migration der Bulls-Datenbereiche (`bulls_weight_logs`, `bulls_progress_photos`, …) auf `organization_*` — kommt in Folge, aktuell parallel.
- Org-eigene Rankings/Challenges/Community-Feeds — nur Feature-Flags, keine UI.
- RWE- und SGZ-Seed-Daten — Anlage erfolgt später via Admin-UI.

## Technische Details (kompakt)

- Tabellen: siehe §1. Alle GRANTs für `authenticated` + `service_role`; kein `anon` außer für die Org-Landing-Seite (public read auf `organizations` mit `status='active'` und Whitelisted Columns via `TO anon` SELECT-Policy — nur `id, name, slug, organization_type, logo_url, primary_color, secondary_color`).
- Enums werden neu erstellt (`organization_type`, `organization_role`, `membership_status`, `invite_status`, `team_status`).
- Route-Naming: TanStack-Dot-Konvention (`org.$slug.tsx` = `/org/$slug`). Wir nutzen aber `$slug.tsx` direkt auf Top-Level? — **Nein**, um Slug-Kollisionen mit bestehenden Routen zu vermeiden, nutzen wir Prefix `/o/:slug` NICHT vom User gefordert. Der User will `/bulls` direkt. Kompromiss: Slug direkt auf Top-Level, aber DB-Trigger blockt reservierte Namen; Route-Datei ist `src/routes/$orgSlug.tsx` mit `beforeLoad`, das per Server-Fn prüft und bei "keine Org" via `throw notFound()` an globales 404-Handling durchreicht. Bestehende Top-Level-Dateien (`dashboard.tsx` etc.) haben Vorrang, weil TanStack statische Routen vor dynamischen matcht — daher sicher.

Nach Migration werden alle abhängigen Files (Server-Fns, Routen, Context, Coach-Menü) angelegt bzw. erweitert.
