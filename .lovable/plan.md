
# BodyFuel Performance Onboarding — Unified Flow

## Was der Audit ergeben hat

**Bestehende Source of Truth für persönliche Nutrition-Präferenzen: `smart_nutrition_profile`.**
Sie hat bereits alle relevanten Spalten — sie wird nur nicht in den Performance-Flow eingebunden:

| Kategorie | Spalten in `smart_nutrition_profile` |
|---|---|
| Lieblingsfoods | `favorite_foods[]`, `extra_favorites` |
| No-Gos | `nogo_foods[]`, `extra_nogos` |
| Allergien | `allergies[]`, `extra_allergies` |
| Unverträglichkeiten | `intolerances[]` |
| Ernährungsform | `diet_style`, `diet_notes` |
| Mahlzeitenstruktur | `eating_style`, `meal_prep_style`, `meal_prep_days`, `variety_level` |
| Küche | `kitchen_equipment[]`, `kitchen_equipment_notes` |

**Performance-spezifisch bleibt** in `performance_nutrition_profiles`:
`sex_for_energy_calculation`, `baseline_daily_activity`, `performance_goal`, `organization_id`.

**Aktueller Bulls-Plan-Builder liest nur `nogo_foods`** und ignoriert Allergien, Diätform, Unverträglichkeiten und Mealprep-Präferenzen komplett. Das ist der Sicherheits- und Personalisierungs-Kernfehler, den wir hier fixen.

**Datenlage in Coesfeld Bulls Seniors (13 Athleten):**
- `performance_nutrition_profiles`: **0 Rows** → alle blockiert.
- `smart_nutrition_profile`: 9 Rows vorhanden, 4 fehlen (Nassim, Patrick, Sven, Manuel-dup).
- Bekim: SNP komplett (Favs, `diet_style=omnivore`, `meal_prep_style=meal_prep`). Fehlt: PNP-Row (sex/activity/goal).
- Lars: SNP teilweise (Favs, `meal_prep_style=2_3_week`, aber `diet_style=NULL`). Fehlt: PNP-Row + diet_style.

## Architekturgrundsatz

- **Ein Athleten-Onboarding**, mobil, unter `/$orgSlug/onboarding`.
- Persönliche Präferenzen → **immer** `smart_nutrition_profile` (upsert, bestehende Werte bleiben).
- Performance-Kontext → `performance_nutrition_profiles` (org-scoped).
- Biometrie → `profiles` + `body_measurements` (nur wenn leer/veraltet).
- **Keine neue Präferenztabelle. Keine doppelten No-Go-/Allergie-Listen.**

## Änderungen im Detail

### 1. Onboarding-Wizard erweitern
**Datei:** `src/routes/$orgSlug.onboarding.tsx` (aktuell 3-Feld-Formular → 10-Schritt-Wizard).

10 Schritte, alle bestehenden Chip-Grids/Enums aus `onboarding.smart.tsx` und `onboarding.smart-nutrition.tsx` **wiederverwenden** (kein neues UI-Kit, keine neuen Enums):

| # | Schritt | Felder | Zieltabelle |
|---|---|---|---|
| 1 | Athletenprofil | `gender`, `birthdate`, `height_cm`, aktuelles `weight_kg`, `position` | `profiles`, `body_measurements`, `team_memberships.position` |
| 2 | Performance-Ziel | 5 Optionen → `performance_goal` | `performance_nutrition_profiles` |
| 3 | Alltag | 4 Optionen → `baseline_daily_activity` | `performance_nutrition_profiles` |
| 4 | Lieblingsfoods | `favorite_foods[]` + `extra_favorites` (Chip-Grid aus Smart, 16 Items) | `smart_nutrition_profile` |
| 5 | No-Gos | `nogo_foods[]` + `extra_nogos` (Chip-Grid aus smart-nutrition) | `smart_nutrition_profile` |
| 6 | Allergien & Unverträglichkeiten | `allergies[]` + `extra_allergies` + `intolerances[]` | `smart_nutrition_profile` |
| 7 | Ernährungsform | `diet_style` (6 Optionen: omnivore/flexitarian/pescetarian/vegetarian/vegan/other) + `diet_notes` | `smart_nutrition_profile` |
| 8 | Essensalltag | `eating_style` + `meal_prep_days` (nur wenn meal_prep) | `smart_nutrition_profile` |
| 9 | Kochen & Mealprep | `meal_prep_style`, `kitchen_equipment[]` (falls Zeit) | `smart_nutrition_profile` |
| 10 | Zusammenfassung | Read-only Übersicht + „Performance-Profil abschließen" | — |

Bestehende Werte pro Schritt vorbefüllen. Für Bekim würden Schritte 4/5/6/7/9 vollständig vorbelegt sein; er bestätigt nur.

Für Position (`team_memberships.position`): nur schreiben, wenn leer — bestehende Position (z. B. Bekim=QB) bleibt.

`sex_for_energy_calculation` wird **automatisch aus `profiles.gender`** abgeleitet (`male→MALE`, `female→FEMALE`, `other→UNSPECIFIED`) — keine zusätzliche Frage.

### 2. Neuer Completion-Server-Fn
**Neue Datei:** `src/lib/performance-nutrition/onboarding.functions.ts`

Zwei Server-Fns mit `requireSupabaseAuth`:

- `completePerformanceOnboarding({ organizationId, ...allFields })` — atomarer Upsert-Batch:
  1. `profiles` upsert (nur leere/geänderte Biometrie-Felder)
  2. `body_measurements` insert (nur wenn Gewicht neu)
  3. `smart_nutrition_profile` upsert (**bestehende Werte bleiben, wenn Client sie nicht mitschickt** — dedizierte „preserve" Logik über sparse payload)
  4. `performance_nutrition_profiles` upsert (unique auf `(user_id, organization_id)`)
  5. Server-side Validierung: engineReady + mealPlanningReady
  6. Wenn beides `true` → `performance_plan_jobs` insert mit `trigger='PERFORMANCE_PROFILE_COMPLETED'` (der bestehende Unique-Index verhindert Duplikate)

- `getPerformanceOnboardingCompletion({ organizationId })` — Read-only Status:
  ```ts
  {
    status: "COMPLETE" | "PARTIAL" | "MISSING",
    engineReady: boolean,          // biometrics + PNP komplett
    mealPlanningReady: boolean,    // SNP Pflichtfelder komplett
    missingPerformanceFields: string[],
    missingNutritionFields: string[],
    completionPercent: number,
  }
  ```

**mealPlanningReady-Pflichtfelder** (bewusst restriktiv, damit der Plan-Builder sicher ist):
`diet_style` gesetzt UND `allergies` und `intolerances` gepflegt (bewusster Athletencheck; leere Arrays sind ok, aber `NULL` = ungeprüft = nicht ready) UND `meal_prep_style` gesetzt.

### 3. Plan-Builder härten
**Dateien:** `src/lib/performance-nutrition/plan-builder.ts`, `.../auto-plan.functions.ts`

**a) `AthletePreferences` erweitern** (`plan-builder.ts`):
```ts
type AthletePreferences = {
  no_go_ingredients: string[];
  extra_nogo_terms: string[];      // free-text tokenized
  allergy_tokens: string[];         // aus allergies + extra_allergies + intolerances
  diet_style: "omnivore" | "flexitarian" | "pescetarian" | "vegetarian" | "vegan" | "other" | null;
  meal_prep_style: "daily" | "2_3_week" | "meal_prep" | "low_effort" | null;
  wants_snack: boolean;             // aus eating_style abgeleitet, nicht mehr hardcoded
}
```

**b) Neue Filter im Meal-Pool** (zusätzlich zu `violatesNoGo`):
- `violatesDiet(meal, diet_style)` — Fisch/Fleisch/Ei/Milch je nach Diät ausschließen. Nutzt bestehende Meal-Tags aus `coach_meal_library` (Feld `dietary_tags[]` oder `contains_animal_products`, je nach Schema — der Impl-Schritt prüft die genaue Spalte).
- `violatesAllergy(meal, allergy_tokens)` — Ingredient-Match auf `no_go_ingredients`-artigem String-Contains, aber gegen `allergy_tokens` und mit **fail-safe reject** (bei Zweideutigkeit rejecten, nicht akzeptieren — Sicherheit vor Auswahl).
- `mealPrepFitScore(meal, meal_prep_style)` — Soft-Score, kein Hard-Filter (bevorzugt Meal-Prep-taugliche Meals bei `meal_prep`, one-shot Meals bei `daily`).

**c) `auto-plan.functions.ts` erweitern:**
- SELECT auf `smart_nutrition_profile` um alle relevanten Spalten erweitern.
- Neuer `profileMissing`-Guard: zusätzlich `!snp?.diet_style` oder `snp?.allergies IS NULL` → `SKIPPED_PROFILE_INCOMPLETE` mit klarem `reason`-Feld im History-Row.
- Preferences-Objekt bauen und an `pickMealsForDay` / `reoptimizeExistingDay` weitergeben.

**d) `wants_snack`** aus `eating_style` ableiten:
- `eating_style === "meal_prep"` → true
- `eating_style === "fresh"` und `meal_prep_days` klein → true
- Sonst true (Default bleibt; explizite Athletensteuerung kommt später wenn nötig).

### 4. Bulls Hub Completion-Card
**Datei:** `src/components/bodyfuel/BullsPlanContentView.tsx` (bestehend, minimale Ergänzung).

Wenn `getPerformanceOnboardingCompletion` `status !== "COMPLETE"`:
- Card mit Text „Dein Performance-Profil ist noch nicht vollständig." + Zähler „Uns fehlen noch N Angaben." + Button „Profil vervollständigen" → `/$orgSlug/onboarding` mit Query-Param `?resume=1`.
- Wenn `COMPLETE` aber Job noch `pending/processing`: „Deine Performance-Woche wird vorbereitet."
- Wenn Plan da: bestehende Plan-View.

Keine technischen Begriffe, keine Statuscodes im UI.

### 5. Resume-Modus im Wizard
Wenn `?resume=1`:
- `getPerformanceOnboardingCompletion` beim Mount aufrufen.
- Fehlende Felder ermitteln, Wizard direkt auf ersten fehlenden Schritt springen.
- Bereits-vollständige Schritte als grüne Checks in der Progress-Bar anzeigen (nicht überspringen — Athlet kann optional zurück).

### 6. Bootstrap-Read für bestehende 13 Bulls-Athleten
Keine Migration mit Defaults. Keine Auto-Werte.

Stattdessen: `getPerformanceOnboardingCompletion` funktioniert bereits für sie — sobald sie den Bulls Hub öffnen, sehen sie die Completion-Card. Ein separater Report-Endpoint für Coach-Sicht (welcher Athlet in welchem Status) kommt in einem Folgeschritt, nicht in diesem.

## Nicht in diesem Schritt

- Coach-Overrides pro Athlet.
- Session-Intensity-UI.
- Neue Push Notifications.
- Änderung des Smart-Nutrition-Onboardings selbst.
- Datenwriting in bestehende Athletenprofile ohne Athletenaktion.

## Technische Notizen (für den Impl-Schritt)

**Dateien, die berührt werden:**
- `src/routes/$orgSlug.onboarding.tsx` — Wizard erweitern (10 Schritte statt 3 Felder).
- `src/lib/performance-nutrition/onboarding.functions.ts` — **NEU**: `completePerformanceOnboarding`, `getPerformanceOnboardingCompletion`.
- `src/lib/performance-nutrition/plan-builder.ts` — `AthletePreferences` erweitern, `violatesDiet` / `violatesAllergy` / `mealPrepFitScore` hinzu.
- `src/lib/performance-nutrition/auto-plan.functions.ts` — SNP-SELECT erweitern, Preferences-Objekt bauen, härterer `profileMissing`-Guard.
- `src/lib/performance-nutrition/__tests__/plan-builder.test.ts` — neue Tests: `violatesDiet`, `violatesAllergy`, allergiehartes Reject, `mealPlanningReady`-Skip.
- `src/components/bodyfuel/BullsPlanContentView.tsx` — Completion-Card + „Profil vervollständigen"-Button.
- Kein DB-Migration nötig für den Kernpfad (alle Spalten existieren).

**Sparse Upsert für SNP:** damit der Wizard bestehende Bekim-Favoriten nicht überschreibt, wenn er sie unangetastet lässt, wird der Server-Fn nur die **explizit im Payload gesetzten** Felder in den `UPDATE`-Teil aufnehmen. Zod validiert das mit `.partial()`.

**Allergie-Sicherheit:** `allergy_tokens` mergt `allergies[]` + tokenisierte `extra_allergies` + `intolerances[]`. Der `violatesAllergy`-Filter macht substring-match ohne Ambiguitätstoleranz (z. B. „Nüsse" matcht „Cashew" nicht — deshalb prüfen wir auch gegen `meal.no_go_ingredients` und `meal.contains_allergens`, sofern vorhanden). Bei fehlenden Meal-Metadaten Reject-by-default für die betreffende Allergie-Klasse.

**Reihenfolge des Impl-Schritts (nach Freigabe):**
1. Server-Fns + Reader (`onboarding.functions.ts`, Zod-Schemas).
2. Plan-Builder-Extension + neue Filter + Tests.
3. Wizard-UI mit sparse Prefill (10 Schritte).
4. BullsPlanContentView Completion-Card.
5. Alle Tests grün, dann Report mit Bekim/Lars/13-Athleten-Status.

## Abschließender Report nach Impl (auf Auftragswunsch)

Ich liefere danach:
- SNP-Feldliste (aus diesem Audit übernommen).
- Welche Felder das neue Bulls-Onboarding wiederverwendet: alle 12 Nutrition-Felder, kein Duplikat.
- Was Bekim heute bereits hat (SNP fast komplett, PNP fehlt).
- Was Lars heute bereits hat (SNP partial, `diet_style` fehlt, PNP fehlt).
- Was Bekim noch braucht: PNP (sex leitbar aus profiles.gender=male → MALE, baseline_daily_activity, performance_goal).
- Was Lars noch braucht: `diet_style` + PNP.
- Aufschlüsselung der 13 Seniors nach COMPLETE / PARTIAL / MISSING (aus dem Audit ergibt sich schon: 0 COMPLETE, 9 PARTIAL, 4 MISSING).
- Bestätigung, dass Plan-Builder nun Likes/No-Gos/Allergien/Unverträglichkeiten/Diät/Mealprep berücksichtigt.
- Bestätigung, dass keine doppelte Nutrition-Preference-Struktur entstanden ist.
