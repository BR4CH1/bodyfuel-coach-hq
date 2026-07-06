# Strukturelle Trennung Vereinsbereich — Person / Membership / Produkt

Der Auftrag ist groß und muss in klar abgegrenzten Phasen laufen, sonst zerbrechen bestehende Accounts, RLS und Permission-Ketten. Dieser Plan bricht ihn in 5 Phasen. Jede Phase ist ein eigener, verifizierbarer Schritt — ich schlage vor, sie in dieser Reihenfolge einzeln freizugeben, statt in einem Turn alles zu bauen.

Interne Role- und Permission-Keys, RLS und Server-Signaturen bleiben in allen Phasen unverändert. Änderungen sind additiv.

---

## Phase 1 — Zentrale Rollen- und Entitlement-Logik

Grundlage für alles Weitere. Keine sichtbare Änderung außer versteckten `/$orgSlug/*`-Routen für Nicht-Athleten.

### Neu: `src/lib/organizations/org-role.ts`
Reine Ableitungshelfer aus `getOrganizationContext` / `getOrgHomeData` (kein neuer Server-Call):

```
type OrgRole = "player" | "team_coach" | "head_coach" | "org_admin" | "staff" | "none"
deriveOrgRole(ctx): { role, isPlayer, isTeamCoach, isHeadCoach, isOrgAdmin, isStaff, isSuperAdmin }
```

Regeln (nur Ableitung, keine DB-Änderung):
- `organization_memberships.role = "athlete"` → `isPlayer`
- `staff_assignments.role = "organization_admin"` → `isOrgAdmin` (= Vereinsleitung)
- `staff_assignments.role = "coach"` + Preset `TEAM_COACH` / Permissions ohne `manage_organization` → `isTeamCoach`
- Ein User kann gleichzeitig `isPlayer` UND `isTeamCoach` sein.

### Neu: `src/lib/bodyfuel/entitlements.ts`
Zentraler Hook + Server-Helper. Aggregiert bestehende `customer_packages` + `subscriptions` + `user_roles`, ohne neue Tabellen:

```
useEntitlements() → {
  hasBodyfuelFree, hasBodyfuelSmart, hasBodyfuelCoaching,
  hasAnyPersonalBodyfuel,   // smart || coaching
  hasTeamAccess              // aktive Vereinsmitgliedschaft in irgendeinem Verein
}
```

Bestehende `useSession().isCoach / isFreeUser / tier` bleiben unverändert (interne API, nur intern). Neue UI-Entscheidungen laufen ausschließlich über `useEntitlements()`.

### AppLayout / Session-basierte Navigation
`src/components/bodyfuel/AppLayout.tsx`:
- Wenn `!hasAnyPersonalBodyfuel && hasTeamAccess`: Client-Navigation (Dashboard/Ernährung/Training/Coach-Chat/…) wird **nicht** mehr gezeigt. Direktes Öffnen von `/dashboard`, `/training`, `/nutrition` etc. redirected auf primären Vereinsslug (`/$orgSlug`).
- `Mein BodyFuel` erscheint als **einziger optionaler Eintrag** mit Untertitel „Training, Ernährung und Fortschritt persönlich steuern" → linkt auf eine leichte Upgrade-Seite `/mein-bodyfuel` (neu, siehe unten).
- Wenn zusätzlich Smart/Coaching vorhanden: klassisches Client-Menü bleibt.

### Neu: `src/routes/mein-bodyfuel.tsx`
Info-/Upgrade-Landing für Nur-Vereins-Accounts. Kein Zugang zu Smart-Plänen, Ernährung, Autopilot.

---

## Phase 2 — Rollenbasiertes Onboarding ✅ ABGESCHLOSSEN

Ziel: „Coach" wird nie als Position gespeichert. Coaches durchlaufen kein Athleten-Onboarding.

### Trennung in zwei Flows
`src/routes/$orgSlug.onboarding.tsx` wird zum **Dispatcher**:
- Ermittelt Rolle via `deriveOrgRole(ctx)`
- Wenn `isPlayer` (auch zusätzlich zu Coach): Athleten-Onboarding
- Wenn nur Staff/Coach/HeadCoach: Staff-Onboarding
- Wenn beides und `!onboarding_completed`: Athleten-Onboarding zuerst

### Basisdaten-Schritt (für alle Rollen)
Neuer Vor-Schritt, prüft `profiles.first_name`, `last_name`, `birthdate`, ggf. `nickname`, `avatar`. Fragt nur ab, was fehlt. Bestehende profiles-Werte werden respektiert.

### Athleten-Schritt (nur `isPlayer`)
Zusätzlich zu bisherigen Feldern **verpflichtend**:
- `height_cm` → `profiles.height_cm`
- aktuelles `weight_kg` → in **bestehende** `body_measurements`-Tabelle als erster Eintrag (`source: "onboarding"`). Keine neue Weight-Tabelle.
- `personal_goal` wird auf deutsche Labels umgestellt (Anzeige-Layer, DB-Wert bleibt englisch für Kompatibilität — Mapping in `staff-labels.ts`-Pendant `athlete-labels.ts`).

### Staff-/Coach-Schritt (kein `isPlayer`)
Nur:
- Basisdaten (falls fehlend)
- optional „Funktion im Team" (Freitext oder Select: Position Coach / Offensive / Defensive / S&C / Player Care / Sonstige) → gespeichert als neues Feld `staff_assignments.function_label text` (nur Anzeige, keine Permission-Wirkung).
- Kein Gym Access, keine Trainingstage, keine Position, keine Trikotnummer, kein persönliches Athletik-Ziel.

### Fallback für Bestandsdaten
Beim nächsten Öffnen von `/$orgSlug/home` prüft ein leichter Guard, ob `first_name/last_name/birthdate` fehlen — falls ja, kurzer Dialog „Dein Profil vervollständigen". Kein Full-Reset.

### Migration
Additiv: `staff_assignments.function_label text NULL`. Keine Umbenennungen, keine Backfills. RLS unverändert.

---

## Phase 3 — Rollenbasierte Navigation & Home-Dispatcher ✅ ABGESCHLOSSEN

### `src/routes/$orgSlug.index.tsx` und `$orgSlug.home.tsx`
- Bereits vorhandener Dispatcher wird geschärft: Staff-only-User → weiterhin `/coach/teams/$orgId`. Neu: **Player+Coach-Dual-Rolle** landet standardmäßig im Modus, der zuletzt gewählt wurde; kein „Coach sieht Spieler-Home"-Fallback mehr.
- `$orgSlug.home.tsx` prüft `isPlayer`; wenn nicht → redirect zu `/coach/teams/$orgId`. Kein Player-Dashboard mehr für Coaches.

### `src/components/organizations/OrgAthleteLayout.tsx`
Rollenspezifische Nav (ohne bestehende Struktur zu verdoppeln):
- Spieler: HOME · TRAINING · RANKING · COMMUNITY · PROFIL (unverändert)
- Team-/Head-Coach im Athleten-Layout kommt nicht mehr vor (siehe oben, Redirect).

### Coach Navigation
`coach.teams.$orgId.tsx` bleibt strukturell, aber Header wird um `deriveOrgRole` erweitert:
- `TEAMCOACH` Badge nur bei `isTeamCoach && !isOrgAdmin`
- `HEAD COACH / VEREINSLEITUNG` Badge bei `isOrgAdmin`
- Zeigt niemals persönliche Player-Karten (Team Rank, persönlicher Performance Score) im Coach-Kontext, auch wenn der User selbst Player ist. Player-Werte nur unter Athletenmodus (`/$orgSlug`).

### Training-Link
Der Nav-Eintrag „Training" im Vereinsbereich linkt bereits auf `/$orgSlug/training` (bestätigt durch Analyse). Ich prüfe & entferne alle Stellen, wo Coach-Kontext irrtümlich auf `/training` (persönlich) verweist. Keine strukturelle Änderung, nur Verifikation.

---

## Phase 4 — Analytisches Coach-Cockpit

Größte inhaltliche Änderung. Ersetzt den bisherigen Tab-basierten Coach-Screen NICHT — er wird um einen neuen Dashboard-Tab ergänzt und dieser als Default gesetzt. Bestehende Tabs (Athleten, Teams, Training, Tasks, Challenges, Ranking, Community, Staff, Einstellungen) bleiben unverändert.

### Neu: Server-Fn `getOrgCoachAnalytics(orgId, range)`
In `src/lib/organizations/coach-analytics.functions.ts`. Berechnet aus vorhandenen Tabellen:
- **Team Pulse**: Wochen-Compliance (aus `organization_challenge_progress` + `organization_tasks`), Trainingsaktivität (`organization_athletic_session_completions`), aktive Spieler, Teamtrend — jeweils inkl. Vorwochenvergleich. Bei zu wenig Daten: `null` Trend → UI zeigt „Noch nicht genügend Vergleichsdaten".
- **Coach Radar**: Regel-basierte Insights, alle aus echten Daten:
  - Spieler mit ↓ Compliance ≥ X% ggü. Vorwoche
  - Spieler ≥ 7 Tage inaktiv (letztes `organization_activity_log` / `body_measurements` / `training_sessions`)
  - Positionsgruppen mit Compliance < Team-Ø − 10%
  - Positive: WR/OL/DL mit höchster Trainingsaktivität
- **Positionsgruppen-Analyse**: Aggregation über `team_memberships.position`. Alle Werte optional; wenn Datengrundlage fehlt → weglassen, nicht erfinden.
- **Aufmerksamkeitsliste**: berechneter Status pro Player nach Regelsatz (Kritisch/Aufmerksamkeit/Beobachten/Stabil/Positiv). **Regel-Definitionen zentral in `coach-analytics.rules.ts`**, nicht in Komponenten.

### Neu: `src/components/coach/analytics/*`
- `TeamPulse.tsx` (Karten mit Trend-Chip)
- `CoachRadar.tsx` (Kategorien Kritisch/Beobachten/Positiv, jede Zeile klickbar → Drill-down)
- `PositionGroupsAnalysis.tsx`
- `AttentionList.tsx`
- Alle mobile-first, verwenden vorhandene Chart-Komponenten (`recharts` bereits im Repo).

### Drill-Down: Spieleranalyse
`src/routes/coach.teams.$orgId.athletes.$userId.tsx` (neu). Berechtigung: `is_org_staff(user, org, 'view_members')`. Zeigt Übersicht, Aktivität, Athletik, Trends, offene Punkte. **Kein Zugriff auf persönliche BodyFuel-Ernährungs-/Coaching-Daten** — Query greift ausschließlich auf Team-/Athletik-/Measurement-Tabellen zu (RLS ist bereits eng, wird nicht gelockert).

### Head-Coach-Variante
Gleiche Komponenten, aber `getOrgCoachAnalytics` liefert bei `isOrgAdmin` zusätzlich:
- Staff Overview (aus `staff_assignments` + `organization_activity_log`)
- Positionsgruppen-Vergleich vollständig
- ohne implizite Beschränkung auf zugewiesene Gruppen

Team-Coach sieht heute noch alle Spieler; die Analytics-Fn ist so gebaut, dass eine spätere Positions-/Team-Scoping-Ergänzung nur eine WHERE-Klausel ist — kein Hardcoding „jeder Coach sieht alle".

---

## Phase 5 — Verifikation Akzeptanztests A–D

Nach jeder Phase Playwright-Smoketest via Sandbox. Am Ende:

- **A** Manuel (Coach ohne Smart): Vereinsbereich okay, Cockpit statt Player-Dashboard, kein Team Rank/Perf-Score, kein persönlicher Trainingsplan freigeschaltet, `Mein BodyFuel` nur als Upgrade-Eintrag.
- **B** Player ohne Smart: Player-Dashboard, Player-Onboarding, Team-Training + Ranking, kein Smart.
- **C** Player + Smart: Beides parallel, `Mein BodyFuel` voll nutzbar.
- **D** Head Coach: Head-Coach-Dashboard, Team- + Staff-Übersicht, kein Player-Onboarding.

---

## Was NICHT passiert

- Kein Rename interner Keys (`view_performance`, `manage_training`, `has_role`, `is_org_staff`, `organization_role` Enum, App-Role Enum).
- Keine neuen RLS-Policies für bestehende Tabellen (außer additivem `staff_assignments.function_label`).
- Keine neue Gewichtstabelle — `body_measurements` wird wiederverwendet.
- Keine parallele Coach-Navigation neben bestehender.
- Keine erfundenen Werte / Demo-Insights im Radar.
- Kein Eingriff in Strength-Score V2, Performance-Engine V1 Framework, Bulls-Seed, Bestandsdaten von Kunden.

---

## Technische Details

**Neue Dateien (grobe Liste):**
- `src/lib/organizations/org-role.ts`
- `src/lib/bodyfuel/entitlements.ts`
- `src/lib/organizations/coach-analytics.functions.ts`
- `src/lib/organizations/coach-analytics.rules.ts`
- `src/components/coach/analytics/{TeamPulse,CoachRadar,PositionGroupsAnalysis,AttentionList}.tsx`
- `src/routes/coach.teams.$orgId.athletes.$userId.tsx`
- `src/routes/mein-bodyfuel.tsx`
- `src/routes/$orgSlug.onboarding.staff.tsx` (Athleten-Route bleibt, wird per Dispatcher gewählt)

**Angefasst:**
- `src/routes/$orgSlug.onboarding.tsx` (Dispatcher + Basisdaten-Schritt)
- `src/routes/$orgSlug.home.tsx` (Player-Guard)
- `src/routes/$orgSlug.index.tsx` (Home-Dispatch geschärft)
- `src/routes/coach.teams.$orgId.tsx` (neuer Dashboard-Tab als Default, restliche Tabs unverändert)
- `src/components/bodyfuel/AppLayout.tsx` (Entitlement-basierte Nav)
- `src/components/organizations/OrgAthleteLayout.tsx` (kein struktureller Umbau)
- `src/lib/bodyfuel/session.tsx` (keine API-Änderung — nur intern)

**Eine additive Migration:**
- `ALTER TABLE staff_assignments ADD COLUMN function_label text`

---

## Vorschlag zur Umsetzung

Bitte **einzeln freigeben**, weil jede Phase Deploy- und Auth-Risiko trägt:

1. Phase 1 zuerst (Rollen-/Entitlement-Layer, `Mein BodyFuel`-Landing, AppLayout-Filter) — kleinste Angriffsfläche, sofort sichtbar bei dir als Coach.
2. Phase 2 (Onboarding-Split) — danach.
3. Phase 3 (Nav/Redirects) — danach.
4. Phase 4 (Cockpit) — größter Batch, eigener Turn.
5. Phase 5 (Akzeptanztest gegen A–D).

Sag mir bitte, ob ich mit Phase 1 starten soll, oder ob du an Struktur/Umfang etwas ändern möchtest.
