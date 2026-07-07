
# Smart-Engine in Bulls Hub integrieren

Ziel: Die bestehende BodyFuel-Smart-Funktionalität (Training + Ernährung) wird zur wiederverwendbaren **Engine**. Der Bulls Hub rendert diese Engine mit Bulls-Branding und Vereins-Kontext – **kein Fork, keine Duplikat-Daten**.

---

## Phase 0 – Bestandsaufnahme (zuerst, kein Code)

Bevor irgendetwas umgebaut wird, dokumentiere ich in `.lovable/smart-engine-audit.md`:

1. **Smart-Nutrition-Stack:** welche Routen (`nutrition.*`, `mein-bodyfuel`, `tracker.app.nutrition`), welche Server Functions (`nutrition.functions.ts`, `plan-builder.functions.ts`, `nutrition-plan-ai.functions.ts`, `smart-profile.functions.ts`), welche Tabellen (`nutrition_plans`, `nutrition_plan_meals`, `food_entries`, `nutrition_targets`, `smart_nutrition_profile`, `meal_skips`, `meal_ratings`, `shopping_lists`).
2. **Smart-Training-Stack:** Routen (`training.tsx`, `tracker.app.training`), Server Functions (`training-plan-builder.functions.ts`, `training-plan-ai.functions.ts`), Tabellen (`training_sessions`, `training_exercises`, `training_set_logs`, `training_days`, `athlete_training_schedule`).
3. **Tracker & One-Click:** wo `food_entries` geschrieben werden, wo Tagesziele/Fortschritt berechnet werden – **eine** Source of Truth pro Domäne.
4. **Entitlement-Guards:** welche Komponenten/Fns aktuell hart auf „Smart-Kunde / mein-bodyfuel“ prüfen und **context-aware** werden müssen (`hasSmartAccess(user) OR isOrgMember(org, features.nutrition)`).
5. **Vereins-Mini-Pläne heute:** `athlete_nutrition_schedule`, `org_group_nutrition_schedule`, `org_team_nutrition_schedule`, `athlete_training_schedule`, `org_group_training_schedule`, `organization_team_training_schedule`, `organization_athletic_plan_*` – Was ersetzen wir, was bleibt als **Team-/Coach-Layer**?
6. **Coach-Athletikpläne:** `organization_athletic_plan_assignments` + `_sessions` + `_exercises` + `_completions` bleiben – sie werden zur „COACH“-Trainingsquelle in der Wochenansicht.
7. **Team-Termine:** wo Teamtraining/Team-Events herkommen (`organization_teams`, `bulls_hub_events`).
8. **Branding-Layer:** `AppLayout.tsx`, `BullsHero.tsx`, aktuelle Farbnutzung; wo Design-Tokens verankert sind.

Ergebnis: eine Liste **wiederverwendbar / muss context-aware werden / wird ersetzt / bleibt team-spezifisch**.

## Phase 1 – Architektur-Grundlage (keine sichtbaren Änderungen)

1. **ExperienceContext einführen** (`src/lib/experience/context.tsx`):
   `{ kind: 'personal' | 'organization', orgId?, orgSlug?, theme, features }`. Provider einmal pro Hub-Layout.
2. **Theme-Layer:** CSS-Variablen als semantische Tokens (`--primary`, `--accent`, `--surface`…). Zwei Themes: `theme-bodyfuel` (grün) und `theme-bulls` (rot/schwarz/weiß). Alle Smart-Komponenten migrieren wo nötig weg von hartkodierten Farben zu Tokens (dort wo bereits gemacht: lassen).
3. **Entitlement-Helper** `canUseSmartNutrition(ctx)` / `canUseSmartTraining(ctx)` – akzeptiert personal-Smart **oder** Org-Feature-Flag. Guards in Server Fns umstellen (auth bleibt: `requireSupabaseAuth` + Membership-Check über `has_role`/`org_coach_access`).
4. **Trainingsquellen-Union** `src/lib/training/week-sources.functions.ts`: liefert pro User + Woche ein zusammengeführtes Array `{ source: 'TEAM'|'COACH'|'SMART', ... }`. Nutzt bestehende Tabellen – **keine** neue.

## Phase 2 – Smart-Module extrahieren (Refactor, verhaltensgleich)

Bestehende Views bleiben – aber die inneren Bausteine werden als wiederverwendbare Komponenten exportiert:

- `SmartNutritionDayView`, `SmartMealCard`, `NutritionTracker`, `SmartShoppingList`, `MealSwapDialog`, `OneClickTrackButton`.
- `SmartTrainingWeekView`, `SmartSessionView`, `SmartExerciseLog`, `SmartTrainingHistory`.

Alle lesen/schreiben weiterhin auf die zentralen Tabellen. Keine Copy-Paste-Variante für Bulls.

## Phase 3 – Bulls Hub verdrahten

1. **Neue Player-Navigation** (Bottom-Nav): `HOME · TRAINING · ERNÄHRUNG · TEAM · PROFIL`.
2. **Routen umschichten:**
   - `$orgSlug.training.tsx` – rendert `SmartTrainingWeekView` mit **Trainingsquellen-Union** (TEAM/COACH/SMART Badges). Coach-/Team-Einheiten sind fixe Blocker für die Smart-Planung.
   - `$orgSlug.nutrition.tsx` – rendert die vollständige Smart-Ernährungs-Experience (Tagesansicht, Plan, Tracker, One-Click, Shopping) im Bulls-Theme.
   - `$orgSlug.community.tsx` bleibt, wird zu **TEAM**-Tab und bündelt Community + Ranking + Challenges (Sub-Tabs).
   - `$orgSlug.ranking.tsx` → Redirect auf `team?tab=ranking`.
   - `$orgSlug.home.tsx` – schlankes Dashboard (Wochenfokus, offene Aufgaben aus Team/Coach/Training/Check-in, Trainingswoche-Vorschau, Stand). Ernährungs-Mahlzeiten NICHT als Home-Todos.
3. **Mini-Plan-Deprecation:** Die Vereins-Mini-Plan-Cards im Spielerbereich werden ausgeblendet (Routen bleiben zunächst intakt für Coach-Zuweisungslogik, sofern noch verwendet). Keine Daten löschen – nur UI-Ersetzung.
4. **Onboarding Ernährung** für Bulls-Spieler: nutzt `onboarding.smart-nutrition` in Org-Kontext (writes: `smart_nutrition_profile`).

## Phase 4 – Datenschutz-Guards

- Coach-Views (Athletenprofil in `coach.teams.$orgId.athletes.$userId.tsx`) dürfen **nur** teamrelevante Aggregate zeigen: abgeschlossene Coach-/Team-Sessions, Compliance, Strength-Score.
- Explizit ausschließen: `food_entries`, tägliche kcal/Makros, Meal-Historie, Shopping-Listen, private Smart-Trainingssessions.
- RLS-Policies prüfen: Coach-Rolle darf über `has_role`/`staff_assignments` **keine** SELECTs auf private Smart-Tabellen erhalten. Wenn Policy zu weit ist → verengen.

## Phase 5 – Case-Tests

Manuell durchspielen:
- **Fall A** Bulls-only: kein „Mein BodyFuel“ in HubSelector, Bulls Hub voll funktionsfähig.
- **Fall B** Bulls + Smart-Kunde: beide Hubs, Tracker-Daten identisch (One-Click im Bulls → in `Mein BodyFuel` sichtbar).
- **Fall C** Bulls + Coaching: Coaching-Inhalte nur unter Mein BodyFuel, Coach sieht keine Ernährung.

---

## Nicht in diesem Turn

- Kein Neubau einer „Sportwissenschafts-Engine“.
- Kein Löschen bestehender Mini-Plan-Tabellen.
- Kein Redesign der Smart-Komponenten – nur Theming über Tokens.

## Vorgehen

Ich fange mit **Phase 0 (Audit-Doc)** an und liefere die Bestandsaufnahme + eine konkrete Datei-/Route-Änderungsliste. Erst danach folgen die Refactors (Phase 1–2) und die sichtbare Umschichtung im Bulls Hub (Phase 3+).

**Bestätige bitte:** starte ich mit dem Audit-Doc, oder soll ich direkt in Phase 1 (ExperienceContext + Bulls-Theme-Tokens) einsteigen?

---

## Fortschritt (Turn 1)

**Erledigt:**
- Audit-Dokument: `.lovable/smart-engine-audit.md` (393 Zeilen, Sub-Agent).
- `.bulls-theme` CSS-Override in `src/styles.css` – remappt `--gold` → `--bulls-red` inkl. Gradient-/Shadow-Utilities. Alle Smart-Komponenten innerhalb `bulls-theme`-Scope re-branden automatisch (kein Komponenten-Fork).
- `src/routes/bulls.nutrition.tsx`: statische Mini-Prosa ersetzt durch **volle Smart-Nutrition-Experience** (`PlanContentView`, `MacroTargetsCard`, `WeekScheduleCard`, `PlateauWarning`, `DietPreferencesCard`, `MealWishesCard`, `CustomMealsCard`, Onboarding-CTAs, Tracker/Favoriten/Shopping-Links).
- `src/routes/bulls.training.tsx`: statische Goal-Blöcke ersetzt durch **volle Smart-Training-Experience** (`PlanContentView planType=training`, `TrainingTracker`, `StrengthCheckStatus`, `StrengthSummaryCard`, `AthleteProfileBanner`).
- `src/components/organizations/OrgAthleteLayout.tsx`: fügt automatisch `bulls-theme`-Klasse an, wenn Slug „bulls" enthält → auch die org-basierten Routen (`/$orgSlug/nutrition`, `/$orgSlug/training`) sind rebrandet.
- `src/lib/nutrition-plan.functions.ts`: 4 Entitlement-Guards (`parseNutritionPlan`, `estimateMealMacros`, `getMealMacroDebug`, `generateMealRecipe`) weiten den Zugriff von „nur globaler Coach" auf „Selbst / globaler Coach / Org-Nutrition-Coach" (`assertMealAccess`).

**Offen (nächste Turns):**
- `ExperienceContext`-Provider + generische `.org-theme-<slug>`-Klassen (weitere Orgs neben Bulls).
- Trainingsquellen-Union (TEAM / COACH / SMART Wochenansicht) mit Konfliktprüfung.
- Bottom-Nav Umschichtung: Ranking + Challenges als Sub-Tabs unter TEAM (aktuell noch eigene Tabs).
- Player-Home-Redesign (Wochenfokus/Offene Aufgaben ohne Ernährungs-Todos).
- Explizite RLS-Verengung, falls Team-Coaches über bestehende Policies mehr sehen als sie sollten.
- Deprecation der verbleibenden Vereins-Mini-Plan-UI (task-engine-Tiles in `$orgSlug.training.tsx`).
