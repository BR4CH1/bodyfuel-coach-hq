## QA-Ergebnis (read-only, keine Änderungen)

### Was geprüft wurde
Typecheck (tsgo), 26 Testdateien/185 Tests, DB-RPCs `search_nutrition_foods` / `search_nutrition_foods_variants` mit Ei/Eier/Vollei/Spiegelei/Rührei/Haferflocken, Energie-Plausibilisierung über alle 372 Katalogeinträge, Konsistenz der Code-Pfade (Suche, Barcode, Favoriten, Recent, KI-Schätzung), Console-Logs (leer).

### Bestätigte Fehler

**1. Typecheck bricht mit 17 Fehlern — Schweregrad: hoch (Regression)**
Nach dem Löschen von `src/routes/bulls.index.tsx` existiert die Route `/bulls` nicht mehr, es wird aber weiterhin dorthin navigiert:
`src/components/bodyfuel/BullsRankingContent.tsx:150`, `src/routes/bulls.benchmarks.tsx:124`, `bulls.checkin.tsx:91`, `bulls.nutrition.index.tsx:53`, `bulls.performance.index.tsx:39`, `bulls.performance.tsx:18`, `bulls.photos.tsx:76`, `bulls.recovery.tsx:97`, `bulls.training.tsx:41`, `bulls.weight.tsx:61`, `coach.bulls-performance.tsx:46/49`, `smart.gift.$code.tsx:62/67/107/162`.
Laufzeitfolge: Navigation ins Leere / Fehlerseite für Bulls-Athleten. Nicht durch den Ernährungs-Fix verursacht, aber aktuell offen.

**2. `src/routes/fuely.tsx:68` — Schweregrad: mittel**
`navigate({ to: "/auth" })` ohne erforderlichen `search`-Parameter → Typfehler und potenziell fehlerhafter Redirect für nicht eingeloggte Nutzer.

**3. Test rot: `coach-followups.logic.test.ts` — Schweregrad: mittel**
„deduplicates a customer who appears in several warning categories": erwartet 1 Draft, erhält 4. Die Dedupe-Logik in `src/features/coach-dashboard/lib/coach-followups.logic.ts` greift nicht. Fachlich: Coaches sehen denselben Kunden mehrfach in den Follow-ups. Unabhängig vom Ernährungs-Fix, aber real.

**4. Barcode-Scan kann nie erfolgreich sein — Schweregrad: mittel**
`nutrition_foods` enthält **0 Datensätze mit `barcode`**. `lookupBarcode` (`src/lib/nutrition.functions.ts:198`) sucht ausschließlich mit `.eq("barcode", code)` und zusätzlich `safe_for_smart = true` → jeder Scan endet in „Barcode ist noch nicht im geprüften BodyFuel-Katalog". Zudem inkonsistent: die Suche filtert über `audit_status`, Barcode über `safe_for_smart` (156 der 372 Einträge sind nicht `safe_for_smart`).

**5. RPC-Fehler werden stillschweigend geschluckt — Schweregrad: mittel**
In `runCatalogSearch` (`src/lib/nutrition.functions.ts`, ca. Z. 130-165) werden `direct.error` und `variantHits.error` nie geprüft; bei einem RPC-Fehler erscheint für den Nutzer nur „Keine Treffer in der Datenbank" statt einer Fehlermeldung — genau das Symptom, das ursprünglich gemeldet wurde, wäre wieder unsichtbar.

**6. Suchrauschen durch Substring-Matching bei kurzen Begriffen — Schweregrad: niedrig/mittel**
Beide RPCs matchen mit `search_text LIKE '%token%'`. Bei „ei" liefert die DB u. a. „Eisbergsalat", „Essig", „Beef Jerky", „Casein Protein Pulver". Das TS-Ranking (`rankFoodResults`) schiebt die richtigen Treffer nach oben, das Rauschen bleibt aber in der Liste und verdrängt bei `limit = 15` echte Treffer. Kein Wortgrenzen-/Trigram-Schwellenwert vorhanden.

**7. Dubletten im Ei-Datenbestand — Schweregrad: niedrig**
„Ei (roh)" = 139 kcal und „Vollei (roh)" = 143 kcal sind derselbe Sachverhalt mit abweichenden Werten (beide `bodyfuel_verified`). Nutzer erhalten je nach Auswahl unterschiedliche Ergebnisse.

**8. Restbestand unplausibler Datensätze — Schweregrad: niedrig**
3 Einträge überschreiten die Toleranz (>25 % bzw. >25 kcal), 4 Einträge haben `kcal <= 0`. Die Anzeige korrigiert das zur Laufzeit (`checkFoodEnergy`), die DB-Werte bleiben aber falsch und werden von Pfaden ohne Validierung genutzt.

**9. Validierungslücke außerhalb des Trackers — Schweregrad: mittel**
`checkFoodEnergy` wird nur in `nutrition.functions.ts` (Suche, KI-Schätzung) und `useAddFoodFlow.ts` (Favoriten, Recent) angewandt. **Nicht** validiert werden: `src/features/nutrition-plan-ai/server/meal-computation.server.ts`, `src/lib/nutrition-engine.server.ts`, `src/lib/meal-photo.functions.ts`, `src/components/bodyfuel/MealBuilderDialog.tsx` (Totals) und `src/routes/coach.foods.tsx`. Smart-Pläne und Foto-Tracking können also weiterhin die unkorrigierten kcal verwenden.

### Als korrekt bestätigt
- Ei/Eier/Vollei/Spiegelei/Rührei/Haferflocken liefern jeweils Treffer (Ei 20, Spiegelei 1, Rührei 1, Haferflocken 4); die geseedeten Verified-Einträge sind aktiv und plausibel.
- `food-energy.test.ts` (6) und `food-search.logic.test.ts` grün; keine kcal-Ausreißer mehr bei Ei-/Haferflocken-Datensätzen (Kölln-Fall behoben).
- Keine Console-Fehler in der Preview-Momentaufnahme.

### Empfohlene Reihenfolge einer Behebung (separat zu beauftragen)
1. `/bulls`-Navigationen (Punkt 1) + `fuely.tsx` (Punkt 2) — blockieren den Typecheck.
2. RPC-Fehlerbehandlung (Punkt 5) und Barcode-Pfad (Punkt 4).
3. Validierung auf Plan-/Foto-Pfade ausweiten (Punkt 9), Dubletten und DB-Ausreißer bereinigen (7, 8).
4. Wortgrenzen-Ranking für kurze Begriffe (Punkt 6), Follow-up-Dedupe (Punkt 3).

Es wurden keine Dateien geändert.
