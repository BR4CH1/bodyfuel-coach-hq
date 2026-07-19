# Sprint 1 · Slice 6 · Nutrition Tracker

## Ziel

Den Nutrition Tracker in eine schlanke View, klar getrennte Dialog-Komponenten und zwei fachlich abgegrenzte Hooks zerlegen, ohne den Nutzerfluss zu verändern.

## Ergebnis

### Hauptkomponente

`src/components/bodyfuel/NutritionTracker.tsx`

- vorher: 789 Zeilen
- nachher: 129 Zeilen
- enthält jetzt ausschließlich Rendering und die Verdrahtung der UI-Bausteine

### Neue Dialog-Komponenten

- `src/features/nutrition-tracker/components/FoodSearchPanel.tsx`
- `src/features/nutrition-tracker/components/FoodResultRow.tsx`
- `src/features/nutrition-tracker/components/CustomMealsPanel.tsx`
- `src/features/nutrition-tracker/components/FoodAmountEditor.tsx`

`AddFoodDialog.tsx` ist dadurch von 538 auf 193 Zeilen gesunken und übernimmt nur noch Dialograhmen, Quellenauswahl und View-Wechsel.

### Neue Hooks

- `src/features/nutrition-tracker/hooks/useNutritionTracker.ts`
  - Datum und Tagesart
  - Nutrition Targets
  - Einträge und Wasser
  - Daily-Check-Synchronisierung
  - Löschen und erneutes Laden
  - Bulls-/Personal-Varianten

- `src/features/nutrition-tracker/hooks/useAddFoodFlow.ts`
  - Suchdialog und Live-Suche
  - Barcode, Foto und KI-Schätzung
  - Favoriten und zuletzt getrackte Lebensmittel
  - eigene Mahlzeiten
  - Mengen- und Portionsauswahl
  - Speichern der Einträge
  - Wiederherstellung eines offenen Dialogentwurfs

### Typen

In `src/features/nutrition-tracker/types.ts` wurden gemeinsame Typen für Pick-Optionen und Favoriten-Kandidaten ergänzt.

## Zusätzliche Stabilisierung

- Der Bulls-Reset aktualisiert nun neben der Tagesart auch die dazugehörigen Targets.
- Wasseränderungen und das Löschen von Einträgen besitzen einen optimistischen Rollback bei Datenbankfehlern.
- Das Laden des Trackers setzt `loading` auch bei Fehlern zuverlässig zurück.
- Der Schließen-Button des Add-Food-Dialogs hat ein zugängliches Label erhalten.

## Prüfungen

- ESLint für alle geänderten Nutrition-Tracker-Dateien: bestanden
- gezielter TypeScript-Check inklusive importierter Abhängigkeiten: bestanden
- esbuild Bundle-/Syntaxprüfung: bestanden
- Nutrition-Tracker-Tests: 5/5 bestanden
- Plan-Builder-Regressionstests: 4/4 bestanden
- gesamter Vite-Produktionsbuild: innerhalb des Prüfzeitfensters nicht abgeschlossen
