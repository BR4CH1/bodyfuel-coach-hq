
# Plan Builder im Coach-Bereich

Das ist ein sehr großes Feature (17 Teilfunktionen). Ich schlage vor, es in **4 Phasen** zu bauen, damit du früh eine funktionierende Version testen kannst und wir nicht ein 3.000-Zeilen-PR ohne Feedback schicken.

Zwei Vorab-Entscheidungen brauche ich von dir, sonst baue ich in eine falsche Richtung:

**A) Mahlzeiten-Datenbank:** Die verlangte Struktur (Kategorie, Zutaten, Makros, Mealprep-Flags, Budget, Kochaufwand, …) existiert **so noch nicht**. Wir haben `nutrition_foods` (Zutaten pro 100 g) und `custom_meals` (freie Coach-Meals ohne Tags). Zwei Wege:
- **A1**: Neue Tabelle `coach_meal_library` mit allen geforderten Feldern + Seed mit ~30–50 Standardgerichten (Frühstück/Mittag/Abend/Snack).
- **A2**: `custom_meals` erweitern (Migration + alle bestehenden Meals brauchen Backfill für Kategorie/Tags — sonst fallen sie durch den Filter).

Ich empfehle **A1** — sauberer, bricht nichts, kann später zusammengeführt werden.

**B) Auto-Fill-Logik (Punkt 14 „Tag/Woche automatisch"):** Zwei Optionen:
- **B1 Deterministisch**: Score-basierte Auswahl (Makro-Nähe, Präferenzen) — sofort, kostenlos, reproduzierbar.
- **B2 KI (Lovable AI Gateway)**: Gemini bekommt Kundenprofil + Meal-Library und schlägt Tage vor — flexibler, aber Credits, langsamer.

Ich empfehle **B1** für v1 (Punkt 6 „Score" brauchen wir eh), B2 optional später.

---

## Phase 1 — Fundament (Schema + Einstieg)

1. Migration:
   - Neue Tabelle `coach_meal_library` mit allen Feldern aus Punkt 17 (Kategorie-Enum, Makros, Tags[], no_go_ingredients[], suitable_training/rest, mealprep_ok, eat_cold, effort/budget-Enum, main_protein, main_carb, Zutaten als JSONB).
   - Spalte `meal_slot` (breakfast/lunch/dinner/snack) + `is_locked` + `linked_prep_group` (für Mittag+Abend-Kopplung, Punkt 12) auf `nutrition_plan_meals`.
   - Grants + RLS (Coach liest/schreibt Library; Kunden lesen nur veröffentlichte Pläne — bereits vorhanden).
   - Seed-Migration mit ~40 Standardmeals.
2. Button „Plan manuell erstellen" auf Kundenprofil-Ernährungs-Tab, öffnet neue Route `/coach/customers/$userId/plan-builder`.

## Phase 2 — Builder-UI (Kern)

3. Route `coach.customers.$userId.plan-builder.tsx` — mobilfreundliches Layout:
   - **Oben**: Zeitraum (Start/Ende, Wochenzahl, Trainingstage aus Profil), Kunden-Zusammenfassung (Ziele, No-Gos, Allergien).
   - **Sticky Bilanz-Panel** (Punkt 7): Ziel vs. geplant vs. Abweichung, farbcodiert grün/gelb/rot (Schwellen ±5 %/±10 %).
   - **Tages-Slots**: Frühstück / Mittag / Abend / Snack als Karten mit Button „Mahlzeit auswählen" → Bottom-Sheet mit gefilterter+gescorter Liste (Punkt 4–6). Kein Drag&Drop in v1 (mobil bricht, Punkt 8 erlaubt Alternative).
   - Pro Mahlzeit: Tauschen / Menge anpassen / Entfernen / Fixieren (Punkt 9, 11).
4. Filter-/Score-Engine (`src/lib/plan-builder.functions.ts`):
   - Hard-Filter: Allergien, No-Gos, Budget, Mealprep-Stil.
   - Soft-Score: Makro-Nähe zum Restbedarf des Tages, Lieblingsfoods-Bonus, Trainings-/Restday-Fit → 4 Stufen.
5. Portions-Autoscale (Punkt 10): „Mengen anpassen" skaliert Zutaten proportional bis kcal ±30 nah am Ziel, Coach bestätigt.

## Phase 3 — Wochenplanung + Komfort

6. Tag kopieren / Woche kopieren / Meal auf mehrere Tage / Trainingstag- + Restday-Template (Punkt 13).
7. Mealprep-Kopplung Mittag+Abend (Punkt 12): eine Hauptmahlzeit → zwei Slots via `linked_prep_group`, Portionen automatisch geteilt.
8. „Tag automatisch füllen" + „Woche automatisch vorschlagen" (B1 Score-basiert, Punkt 14).

## Phase 4 — Speichern & Verzahnung

9. Speichern als Entwurf / Aktiv / Veröffentlicht — nutzt bestehende `saveCoachNutritionPlanDraft` (mit `mode: new_plan` oder `append_week`) und die letzte Woche gebauten History-Buckets. Kein Neubau der Persistenz.
10. Kunde sieht veröffentlichte Pläne wie gehabt in `PlansView` — nichts an bestehendem Import/Reader wird geändert.

---

## Technische Details

- **Server fns** (`src/lib/plan-builder.functions.ts`): `listMealLibrary(filter)`, `scoreMealsForSlot({customerId, dayType, remainingTargets})`, `autoFillDay`, `autoFillWeek`, `savePlanFromBuilder(mode)`.
- **Kundendaten-Loader**: liest `smart_nutrition_profile` + `nutrition_targets` + Trainingstage aus `smart_nutrition_profile.training_days`.
- **Nichts kaputt**: Import-Route, Reader, History-Card, `nutrition_plans`-Struktur bleiben unangetastet. Neue Spalten sind additiv mit Defaults.
- **Mobil**: Bottom-Sheet-Auswahl, Tap-Targets ≥ 44 px, Sticky-Bilanz kollabiert oben.

## Out of Scope v1

- Pre-/Post-Workout-Slots (Punkt 3 „optional später") — Enum lässt Platz.
- KI-Auto-Fill (B2) — Score-Version reicht laut Punkt 14.
- Drag & Drop Desktop — Button-Flow funktioniert auf beiden.
- Migration bestehender `custom_meals` → `coach_meal_library` — separat, wenn du das willst.

---

**Bitte bestätige A1+B1** (oder wähle anders), dann starte ich mit Phase 1. Wenn du willst, kann ich Phase 1+2 in einem Rutsch bauen und Phase 3+4 danach.
