# Plan: Spieler-Ebene Aufgaben, Ernährung, Community-Umbau

## Rollen (gilt für Bild 1 + 2)
- Berechtigt zum Zuweisen/Plan-Bauen: `has_role('coach')` **oder** `org_admin`/`head_coach` der jeweiligen Organisation.
- Wird zentral als Helper `canManageOrgAthletes(orgId)` im Server-Fn geprüft.

## 1) Bild 1 — „Manuelle Aufgabe" (Cockpit-Tab)
Kaskadierender Zielbereich mit Stopp-Option auf jeder Ebene:

```
Zielbereich: [ ganzes Team ▾ ]
  ├─ Team:   [ Seniors ▾ ]
  ├─ Gruppe: [ (optional) Linebacker ▾ ]        → wenn gesetzt, Aufgabe nur an Gruppe
  └─ Spieler:[ (optional) Suche + Auswahl ]     → wenn gesetzt, Aufgabe nur an Spieler
```

- Neuer Select "Zielebene": *Ganzes Team* / *Positionsgruppe* / *Einzelner Spieler*.
- Bei "Einzelner Spieler": Kombobox (Command/Popover, shadcn) mit Live-Suche über Vor-/Nachname, gefiltert nach Team und optional Gruppe.
- Backend: `organization_tasks` bekommt zusätzliche Nullable-Spalten `assignee_user_id uuid` und `position_group text`. Bestehende `team_id`-Aufgaben bleiben unverändert. Sichtbarkeit: Athlet sieht Task, wenn `assignee_user_id = auth.uid()` ODER (`position_group` = seine Gruppe UND Team-Mitglied) ODER `team_id` allein gesetzt.
- Plan-Builder-Integration: Wenn Titel/Typ = *Trainingsplan* oder *Ernährungsplan*, öffnet ein Button „Plan-Builder öffnen" den passenden Builder mit Vorbelegung (`client_id = assignee_user_id`) — nur bei Einzelspieler-Ebene aktiv. Für BODYFUEL-Coach → `/coach/plan-builder/$userId` bzw. `/coach/training-builder/$userId`. Für Head-Coach der Org: gleiche Builder-Seiten, nur wenn Zielspieler in Org ist.

## 2) Bild 2 — „Team Training Schedule" erweitern
Direkt unter Team-Dropdown zusätzliche Zeile:

```
Gruppe: [ alle ▾ ]        Spieler: [ (Suche) ▾ ]
```

- Wenn nur Team gesetzt → editiert weiterhin `organization_team_training_schedule` (Team-Wochenplan, existiert bereits).
- Wenn Gruppe gesetzt → neuer Layer `org_group_training_schedule` (team_id, position_group, weekday, title, description).
- Wenn Spieler gesetzt → individueller Wochenplan `athlete_training_schedule` (user_id, weekday, title, description). Zusätzlich Button „Plan-Builder für diesen Spieler öffnen" → `/coach/training-builder/$userId`.
- Auflösungs-Reihenfolge im Spieler-Cockpit: Spieler-Override → Gruppen-Override → Team-Default.

## 3) NEU — Ernährungs-Wochenplan-Sektion (analog Bild 2)
Neuer Bereich im Coach-Cockpit unter Training:

```
ERNÄHRUNGSPLAN (WOCHENPLAN)
Team [▾]   Gruppe [▾]   Spieler [Suche ▾]
Wochentage → „Ernährungsplan öffnen" / „Plan-Builder"
```

- Backend-Tabellen analog: `organization_team_nutrition_schedule`, `org_group_nutrition_schedule`, `athlete_nutrition_schedule`.
- Plan-Builder-Integration: `/coach/plan-builder/$userId` (bestehend) wird angebunden. Zugriff auf **komplette** `nutrition_foods`-Datenbank ist bereits Teil des Builders — hier nur der Einstiegspunkt.
- Nur Coach/Head-Coach dürfen bauen; Vereinsleitung ohne Coach-Rolle sieht read-only.

## 4) Bild 3 — Spieler-App-Layout
- Bottom-Nav Reihenfolge: **HOME · TRAINING · ERNÄHRUNG · COMMUNITY · PROFIL** (Ranking-Tab entfernt).
- **Community**: bekommt oben `Tabs`: *Feed* (bestehend) / *Ranking* (bestehender Ranking-View eingebettet). URL `?tab=ranking` deep-linkbar.
- **Ernährung (neu)**: Route `$orgSlug.nutrition.tsx`. Voller BODYFUEL-Nutrition-Stack:
  - Aktueller Coach-Plan (`PlansView` / `PlanContentView`)
  - Tracker (`NutritionTracker`)
  - Rezepte (`nutrition.favorites`, `nutrition.recipe-from-ingredients`)
  - Einkaufsliste (`nutrition.shopping`)
  - Mahlzeiten-Tausch (`MealSwapDialog`)
  Wiederverwendung der bestehenden Komponenten, nur Layout innerhalb des Bulls-Shells.

## Reihenfolge der Umsetzung
1. **DB-Migration**: neue Spalten in `organization_tasks`, neue Tabellen für Gruppen-/Spieler-Wochenpläne (Training + Ernährung) + GRANT + RLS.
2. **Server-Fns**: `assignOrgTask` erweitern, neue Schedule-CRUD-Fns, Berechtigungs-Helper `canManageOrgAthletes`.
3. **Cockpit-UI (Bild 1)**: Kaskaden-Selector + Spielersuche in `coach.teams.$orgId.tsx` bzw. entsprechender Task-Card.
4. **Wochenplan-UI (Bild 2 + Ernährung)**: gleiche Kaskade in Training-Schedule-Card + neue Ernährungs-Schedule-Card.
5. **Plan-Builder-Buttons** verlinken zu vorhandenen Routen.
6. **Spieler-App**: Bottom-Nav-Umbau, Community-Tabs, neue Ernährungs-Route.
7. **Auflösungslogik** im Spieler-Cockpit (Spieler > Gruppe > Team) für Wochenpläne & Aufgaben-Liste.

## Offen (bestätige kurz)
- **Positionsgruppe pro Spieler**: nutzen wir die bestehende Spalte auf `team_memberships` bzw. `bulls_profiles` (Feld `position`) als Gruppen-Schlüssel, oder soll das ein separates Feld sein?
- **Ernährungsplan-Wochenplan**: reicht 1 Ernährungsplan pro Wochentag (wie beim Training), oder soll pro Tag mehrere Mahlzeiten-Slots (Frühstück/Mittag/Abend/Snack) editierbar sein? Der Plan-Builder deckt die Mahlzeiten-Ebene sowieso ab — die Wochen-Schedule-Ansicht wäre also nur „welcher Plan gilt an welchem Tag / in welcher Woche".
- **Community**: Ranking-Tab-Inhalt = bestehende `$orgSlug.ranking.tsx` 1:1 eingebettet — okay?