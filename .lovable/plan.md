# Diagnose + Fixplan: Kalorien/Makros im Ernährungsplan-Builder

Status: nur Analyse, keine Änderungen. Der konkrete Plan aus dem Screenshot ist mir nicht bekannt (keine Plan-ID) — Schritt 0 bestätigt die Ursachen an echten Zeilen, bevor gefixt wird.

## Datenfluss (verifiziert im Code)

```text
Builder-State (usePlanBuilder)
  day.customTargets  --targetsFor()-->  "Tagesziel" (DayCard)
  meal -> mealMacros(): macro_override > Bibliothek > gespeicherte m.kcal
       -> summarizeDay() = "Geplant"
Speichern: persistBuilderPlan()
  -> saveCoachNutritionPlanDraft(): schickt NUR slot/name/Zutaten (x portion_factor)
     -> Mahlzeiten-kcal/Makros werden serverseitig NEU aus Zutaten berechnet
  -> danach Update: day_type, target_* (gerundet), meal_slot, library_meal_id
Laden: loadBuilderPlan()
  -> macro_override = gespeicherte m.kcal/protein/carbs/fat
  -> customTargets = target_* (fehlende Einzelwerte werden 0)
Planübersicht-Karte: summiert gespeicherte meal.kcal bzw. Makros
```

## Ursachen (Hypothesen, nach Wahrscheinlichkeit)

1. **Kalorien sinken nach Speichern/Laden (Hauptursache „massiv heruntergesetzt")** — `persistBuilderPlan` (src/lib/plan-builder.functions.ts) verwirft die im Builder angezeigten Werte (Bibliothek bzw. `macro_override` aus dem Optimizer) und lässt den Import-Pfad die Mahlzeit aus Zutatennamen neu auflösen. Zutaten ohne Katalogtreffer bekommen 0 oder Fallback-Werte. Beim Laden wird dieser niedrigere Wert als `macro_override` übernommen und schlägt die Bibliothek — die Mahlzeit ist dauerhaft „kleiner". Jeder weitere Speicher-Zyklus kann weiter abweichen (Rundung der Zutatengramm-Werte × portion_factor).
2. **kcal passen nicht zu den Makros (700 vs. 4·52+4·57+9·28 = 688/≈668 je nach Rundung)** — kcal und Makros kommen aus unterschiedlichen Quellen: kcal pro 100 g aus Katalog/Etikett (inkl. Ballaststoffe/Alkohol/Rundung), Makros separat summiert und jede Zutat einzeln gerundet. In der Übersicht werden gespeicherte, bereits gerundete Einzelwerte addiert; es gibt keine Konsistenzprüfung kcal ↔ Makros wie in `meal-macro-truth.ts` für eigene Mahlzeiten.
3. **Tagesziel 1150 vs. Geplant 1223 (+73)** — keine Verwechslung, sondern zwei Quellen: Ziel = `targetsFor(customTargets)`, Summe = `mealMacros` ungerundet. Der Optimizer akzeptiert ±60 kcal (`MACRO_TOLERANCE`), `isBalanced` sogar ±8 %; der Portions-Fallback greift erst ab 10 %. +73 wird daher still akzeptiert. Nach Speichern/Laden ändert sich die Summe wegen Ursache 1 erneut.
4. **Manuelle Ziele teilweise verloren** — `loadBuilderPlan` setzt fehlende `target_*`-Einzelwerte auf 0; `normalizeTargets` klemmt kcal auf 800–6000. Im Tracker-Pfad (`setNutritionTargets`) rundet `round50` kcal und **vertauscht** Trainings-/Restday-Werte, wenn Rest > Training — kann manuell gesetzte Werte „überschreiben". Nicht Builder, aber gleiche Beschwerde.
5. **Stale State im Editor-Dialog** — `MacroTargetEditorDialog` initialisiert Werte beim Öffnen aus `currentTarget`; Dezimaleingaben mit Komma werden über `Number()` zu 0 (`"52,5"` → 0 → Ziel 0). Zu prüfen.

## Schritt 0 — Bestätigung an echten Daten (read-only)
- Betroffenen Plan per Titel/Kunde finden; für jede Mahlzeit gespeicherte kcal/P/KH/F vs. Summe aus `ingredients` vs. Bibliothekswert vergleichen.
- `target_*` der Tage auslesen und mit dem vom Coach gesetzten Wert vergleichen.
- Erst danach Fix-Umfang festziehen.

## Eng begrenzter Fix
1. **Speichern übernimmt Builder-Wahrheit**: `persistBuilderPlan` schreibt nach dem Import-Aufruf die Mahlzeiten-Makros exakt so, wie `mealMacros()` sie im Builder berechnet hat (kcal/P/KH/F, intern ungerundet, erst in der Spalte gerundet). Keine erneute Auflösung aus Zutatennamen für Builder-Pläne.
2. **Eine Quelle für kcal**: gemeinsame Helper-Funktion (Wiederverwendung von `meal-macro-truth.ts`) für Mahlzeit → Summe; Übersicht, DayCard „Geplant" und Prüfung nutzen sie. Anzeige rundet nur am Ende. Weicht gespeicherte kcal um mehr als Toleranz von 4·P+4·KH+9·F ab, dezenter Hinweis statt stiller Anzeige.
3. **Manuelle Ziele unantastbar**: `customTargets` beim Laden nur übernehmen, wenn kcal gesetzt; fehlende Makros nicht auf 0, sondern aus Profil-Ziel ergänzen. Kein automatischer Optimizer-/Rebalance-Lauf ändert `customTargets`. Komma-Eingabe im Dialog parsen.
4. **Toleranz sichtbar**: Tages-Abweichung > ±50 kcal in DayCard als Hinweis („+73 kcal über Ziel") und Optimizer-Toleranz an `isBalanced` angleichen.
5. Tracker-Pfad (`setNutritionTargets`): automatisches Vertauschen Training/Rest entfernen bzw. nur warnen — nur falls Schritt 0 zeigt, dass das die Beschwerde betrifft.

## Tests (Vitest)
- Speichern → Laden liefert identische Mahlzeiten-kcal/Makros (Round-Trip, inkl. Zutat ohne Katalogtreffer).
- Übersicht-Summe = Summe DayCard „Geplant" für denselben Plan.
- kcal/Makro-Konsistenzprüfung markiert 700 kcal bei 52/57/28.
- Manuelles Tagesziel 1150 bleibt nach Optimizer, Speichern, Laden 1150; fehlende Makros werden nicht 0.
- Dialog: „52,5" wird als 52,5 geparst.
- Bestehende 574 Tests bleiben grün; Typecheck sauber. Nicht veröffentlichen.

## Betroffene Dateien
- src/lib/plan-builder.functions.ts (`persistBuilderPlan`, `loadBuilderPlan`)
- src/features/nutrition-plan-builder/lib/plan-builder.logic.ts (`mealMacros`, `summarizeDay`, `targetsFor`)
- src/features/nutrition-plan-builder/lib/macro-optimizer.ts (Toleranz)
- src/features/nutrition-plan-builder/hooks/usePlanBuilder.ts (`normalizeTargets`)
- src/features/nutrition-plan-builder/components/MacroTargetEditorDialog.tsx, DayCard.tsx
- Planübersicht-Karte (nach Schritt 0 exakt identifizieren)
- evtl. src/lib/nutrition.functions.ts (`setNutritionTargets`)
