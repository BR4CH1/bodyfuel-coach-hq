# Partnerplan im Plan Builder

Bestehende Tabellen (`nutrition_partners`, `nutrition_plans.partner_plan_id`, `nutrition_plans.is_partner_plan`, `nutrition_plan_meals.partner_meal_id`) reichen aus – keine Migration nötig.

## 1. Datenmodell im Builder

`BuilderMeal` bekommt zwei neue Felder:
- `linked_partner_group?: string` – gemeinsame ID, wenn Kunde- und Partner-Mahlzeit gekoppelt sind (gleiche Rezeptbasis).
- `ingredients` bleibt pro Person; bei gekoppelter Mahlzeit wird Name/Zutatennamen aus der Master-Seite (Kunde) übernommen, die Grammzahlen sind pro Seite eigen.

`BuilderDay` wird pro Person geführt:
```
BuilderPlan = {
  client: BuilderDay[]      // wie heute
  partner?: BuilderDay[]    // gleiche Länge, gleiche Datumsreihe
}
```
Der Partner hat eigene `type` (train/rest, aus `partner.trainingWeekdays`), eigene Ziele, eigene Bilanz.

## 2. Server-Funktionen (`src/lib/plan-builder.functions.ts`)

Erweitern, nichts parallel neu aufbauen:

- `getCustomerPlanContext` bleibt; wird für Partner ein zweites Mal aufgerufen (`{ customerId: partnerId }`).
- Neue `saveBuilderPartnerPlan({ customerId, partnerId, title, startDate, clientDays, partnerDays, publish })`:
  1. Ruft bestehende Draft-Speicherung `saveCoachNutritionPlanDraft` zweimal auf (einmal je Person), setzt `mode: "new_plan"`, `force: true`.
  2. Danach mit `supabaseAdmin`:
     - `nutrition_plans.is_partner_plan = true` für beide.
     - Kreuz-Update `partner_plan_id` (A↔B).
     - Für jede Tages-Position: passende Mahlzeiten anhand `sort_order` + `linked_partner_group` matchen und `partner_meal_id` kreuzverlinken (nur für gekoppelte Slots).
     - Persistiert wie bisher `meal_slot`, `library_meal_id`, `is_locked`, `linked_prep_group`, `day_type`, `day_date`.

## 3. UI-Änderungen (`src/components/bodyfuel/PlanBuilderPage.tsx`)

- **Sichtbarkeit Toggle**: neuer `getPartnerLink({ user_id: userId })`-Aufruf. Wenn `partner_id` existiert, oben Toggle „Partnerplan mit {partner_name}".
- **Aktivierung**: lädt `getCustomerPlanContext` für Partner + baut parallelen `partnerDays`-State analog `buildDays` (eigene `autoType` aus `partner.trainingWeekdays`, eigene Ziele).
- **Layout pro Tag** (mobile-first):
  - Zwei Tabs „Kunde | Partner" (weil zwei Spalten nebeneinander auf 402 px CSS nicht funktionieren).
  - Auf ≥ md optional zweispaltig.
  - Jede Seite zeigt eigene Ziele, eigene Bilanz, eigenen Train/Rest-Toggle.
- **Gekoppelte Mahlzeit**:
  - Neuer Chip „Gemeinsam" pro Slot. Klick öffnet gemeinsame Rezeptauswahl (Filter: für BEIDE erlaubt: keine `no_go`, keine `allergien`, keine `intoleranzen`).
  - Zutaten identisch benannt, Grammzahlen pro Person editierbar.
  - Namens-/Rezeptänderungen synchronisieren beide Seiten (`linked_partner_group`).
  - Reine Mengenänderung ändert nur die aktive Seite.
- **Getrennte Mahlzeit**: normale Slot-Bearbeitung, nur eine Seite betroffen.
- **Live-Makros**: bereits vorhandene `computeMealTotals` × `portion_factor` pro Person.

## 4. Auto-Fill für Partner

Neuer Helper `autoFillDayPair(dayIdx)` und `runAutoFillWeekPair(mode)`:
1. Kandidatenpool = `libraryMeals` gefiltert auf beide Kontexte (Union der No-Gos/Allergien/Intoleranzen).
2. Für jeden Slot: bevorzugt gemeinsame Mahlzeit; Portionsfaktor pro Person so wählen, dass Zielabweichung minimal ist (einfache Skalierung nach kcal-Anteil pro Slot).
3. Wenn kein gemeinsames Rezept möglich (z. B. Trainingstag vs. Restday-Präferenz kollidiert), fallback: getrennte Rezepte je Person mit den bestehenden `pickMeal`-Filtern.
4. `is_locked` schützt weiterhin – pro Person unabhängig.
5. Mealprep-Kopplung Mittag/Abend bleibt pro Person; falls beide `prepCoupleLunchDinner` haben und die Mahlzeit gekoppelt ist, Rezept identisch, Mengen pro Person.
6. Fehler-Toasts wie heute.

## 5. Reihenfolge im Code

1. `plan-builder.functions.ts`: neue Types + `saveBuilderPartnerPlan`.
2. `PlanBuilderPage.tsx`: Partner-State + Toggle + Tabs + Bilanz pro Person.
3. Gekoppelte Rezeptbasis + Portion pro Person + `partner_meal_id`-Persistenz.
4. Auto-Fill Tag/Woche für Partner (gemeinsame Präferenz zuerst).
5. Speichern via `saveBuilderPartnerPlan` wenn Partner-Modus aktiv, sonst weiter `saveBuilderPlan`.

## 6. Nicht Bestandteil

- Keine Änderung am AI-Partnerplan-Flow.
- Keine neue Tabelle/Spalte.
- Keine automatische Freischaltung ohne aktiven Partnerlink.

Nach Freigabe setze ich Schritt 1–5 in dieser Reihenfolge um.