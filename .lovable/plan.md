## Phase 2: Belastungssteuerung (Load Management)

Modul `load_management` bereits im Katalog. Jetzt: echte Funktionalität dahinter bauen. Ziel: Coach gibt pro Tag eine Belastungsstufe vor, BodyFuel nutzt sie für die Nutrition-Steuerung — unabhängig davon, ob Smart Training aktiv ist.

### Datenmodell (neue Tabelle)

`organization_load_days`
- `id uuid pk`
- `organization_id uuid` → organizations
- `team_id uuid null` → organization_teams (optional, sonst orgweit)
- `date date`
- `load_level smallint` (0 = Rest, 1 = Regen, 2 = Leicht, 3 = Mittel, 4 = Hart, 5 = Matchday)
- `session_type text null` (frei: „Kraft", „Ausdauer", „Spiel", …)
- `notes text null` (Freitext für Coach-Kommentar)
- `created_by uuid` → auth.users
- `created_at`, `updated_at`
- Unique `(organization_id, team_id, date)`

RLS:
- Coaches der Org → full CRUD (`is_org_staff(auth.uid(), organization_id)`)
- Athleten der Org/Teams → SELECT nur für ihre Team-Tage
- GRANTs für `authenticated` + `service_role`

Zusätzlich: `athlete_load_override` (single-user Ausnahmen) — **Skip in Phase 2**, kommt später bei Bedarf.

### Server Functions (`src/lib/organizations/load-management.functions.ts`)

- `listLoadWeek({ orgId, teamId?, weekStart })` — 7-Tage-Fenster, RLS-gesichert
- `upsertLoadDay({ orgId, teamId?, date, load_level, session_type?, notes? })` — Coach-only
- `deleteLoadDay({ id })` — Coach-only
- `getLoadForAthlete({ userId, date })` — Athlet/Coach; wählt den spezifischsten Eintrag (Team > Org)

Alle mit `requireSupabaseAuth` + Feature-Gate (Modul muss aktiv sein).

### UI

**Coach: `src/routes/coach.teams.$orgId.load.tsx`** (neuer Sub-Tab im Vereins-Cockpit)
- Wochenplaner (Mo–So), Navigation ±Woche
- Pro Tag Karte: Dropdown Belastungsstufe (Chips 0–5, farbcodiert), Session-Type-Input, Freitext-Notiz
- Team-Umschalter (orgweit / pro Team)
- Auto-save on blur/change
- Tab nur sichtbar, wenn `load_management` aktiv

**Athlet: `src/components/bodyfuel/LoadWeekBanner.tsx`**
- Kompakter Wochenstreifen im Athleten-Dashboard (`$orgSlug.home.tsx`)
- Heute-Karte prominent: Belastungsstufe, Session-Type, Coach-Notiz
- Read-only

**Navigation:**
- Coach-Sidebar: neuer Punkt „Belastung" wenn `load_management` aktiv
- Auch als Tab im Vereins-Cockpit

### Nutrition-Integration (Vorbereitung, nicht Umsetzung in Phase 2)

- Performance Nutrition Engine kennt bereits `sessionIntensity` / `dayType`.
- Neue Helper-Funktion `loadLevelToDayContext(level)` → mapped auf `DayContextInput` der Engine.
- Athlete-Nutrition-Seite liest `getLoadForAthlete(today)` und übergibt es an die Engine (falls Modul aktiv). Für Orgs ohne `smart_training` ist das der einzige Kanal für die Belastung.
- Konkrete Verdrahtung mit Meal-Plan-Anpassung: eigener nächster Schritt.

### Was NICHT in dieser Phase

- Athlete-Overrides (individuelle Abweichungen)
- AI Smart Load Analysis (Heuristik + AI-Fallback) — kommt danach
- MD-Kontext-Wochen (Matchday-Zyklen als Vorlagen)
- Auto-Regeneration von Ernährungsplänen bei Belastungsänderung

### Reihenfolge

1. Migration (Tabelle, RLS, GRANTs)
2. Server Functions + Types
3. Coach-Wochenplaner-UI + Route + Tab
4. Athleten-Banner im Home
5. Sidebar-Eintrag „Belastung" gegated
6. Typecheck

Danach separat: Nutrition-Verdrahtung, Smart Load Analysis, Overrides.

**OK so — starte ich?**
