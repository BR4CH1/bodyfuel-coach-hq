# Sprint 1 · Slice 5 · NutritionTracker

## Ziel

Die 1.497 Zeilen große `NutritionTracker.tsx` wurde in einen Feature-Bereich überführt, ohne die vorhandenen Tracking-Flows absichtlich zu verändern.

## Ergebnis

`src/components/bodyfuel/NutritionTracker.tsx` wurde von 1.497 auf 789 Zeilen reduziert.

Neu angelegt:

- `src/features/nutrition-tracker/types.ts`
- `src/features/nutrition-tracker/constants.ts`
- `src/features/nutrition-tracker/lib/nutrition-tracker.logic.ts`
- `src/features/nutrition-tracker/components/SourceBadge.tsx`
- `src/features/nutrition-tracker/components/NutritionRing.tsx`
- `src/features/nutrition-tracker/components/NutritionTrackerSections.tsx`
- `src/features/nutrition-tracker/components/AddFoodDialog.tsx`
- `src/features/nutrition-tracker/lib/__tests__/nutrition-tracker.logic.test.ts`

## Ausgelagert

- Datum-Navigation
- Trainingstag-/Restday-Anzeige inklusive Bulls-Variante
- Makro- und Kalorienringe
- Wasser-Tracker
- Mahlzeitenkarten und Eintragsdarstellung
- kompletter Lebensmittel-/Mahlzeiten-Auswahldialog
- Quellen-Badges
- Suchnormalisierung und lokale Trefferlogik
- Favoriten-Schlüssel
- Mengen- und Stück-zu-Gramm-Berechnung
- Summenbildung
- Bereinigung von Plan-Mahlzeitennamen

## Bereinigt

- ungenutzter `planMealKinds`-State entfernt
- gemeinsame Typen und Konstanten zentralisiert
- Mengen- und Summenberechnungen als pure Funktionen testbar gemacht

## Prüfungen

- gezielter ESLint-Check: bestanden
- gezielter TypeScript-Check: bestanden
- esbuild-Parsing/Bundling mit externen Packages: bestanden
- NutritionTracker-Logiktests: 5/5 bestanden
- PlanBuilder-Regressionstests: 4/4 bestanden

Der vollständige projektweite TypeScript-Check wurde ebenfalls gestartet, überschritt aber weiterhin das Zeitlimit. Der gezielte Check der geänderten Dateien war erfolgreich.

## Nächster Slice

- `AddFoodDialog.tsx` in Suchansicht, Ergebnisliste und Mengen-Editor zerlegen
- Favoriten, letzte Lebensmittel und eigene Mahlzeiten in einen Hook verschieben
- anschließend Lade-, Speicher- und Day-Type-Logik aus `NutritionTracker.tsx` in `useNutritionTracker` auslagern
