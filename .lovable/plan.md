# 👥 Partner-Modus für gekoppelte Ernährungspläne

Großes Feature — ich teile es in 5 Bauabschnitte, damit du nach jedem Schritt testen kannst. Hier der Gesamtplan.

## 1. Datenmodell (Migration)

Neue Tabelle `nutrition_partners` (1:1-Kopplung zwischen zwei Kunden):
- `id`, `user_a`, `user_b` (uuid → profiles.id), `created_by` (Coach), `created_at`
- Unique-Constraint auf normalisiertem Paar (least/greatest), damit eine Person nur einen Partner hat
- RLS: Kunde darf eigene Kopplung lesen; Coach darf alles

Erweiterungen bestehender Tabellen:
- `nutrition_plans`: `partner_plan_id uuid` (FK auf zweiten Plan), `is_partner_plan boolean`
- `nutrition_plan_meals`: `partner_meal_id uuid` (verknüpft die zwei Portionen desselben Gerichts), `is_shared boolean`
- `shopping_lists`: `scope text` (`'individual' | 'partner_combined'`), `partner_user_id uuid`

## 2. Coach-UI: Partner verknüpfen

In `src/routes/coach.customers.$userId.tsx`:
- Neue Karte `PartnerLinkCard` mit Status:
  - **Nicht verknüpft** → Button „👥 Partner verknüpfen" + Dropdown (Suche über andere Kunden des Coaches)
  - **Verknüpft** → Anzeige „Partner-Modus aktiv — verknüpft mit X" + Buttons „Partner ändern", „Partner entfernen", „Gemeinsamen Plan erstellen"
- Server-Funktionen: `linkPartner`, `unlinkPartner`, `listLinkablePartners`

## 3. KI-Generator für Partner-Pläne

Neue Server-Funktion `generatePartnerNutritionPlanDraft` (parallel zu bestehender `generateAiNutritionPlanDraft`):

Eingaben:
- beide `user_id`
- `shared_slots`: { breakfast, lunch, dinner, snack } (Standard: nur dinner)
- `start_mode` wie bisher

Logik:
1. Lade für **beide** Kunden parallel: Profil, Zielgewicht, Targets (Training+Rest via ISSN-Cycling), Allergien, No-Gos, Favoriten, Bewertungen, Trainings-Wochentage
2. Baue für jeden Tag pro Person einen eigenen Typ (Training/Rest) — bleibt individuell
3. Prompt an Gemini: Erzeuge JSON mit `days[]`, jeder Tag enthält `person_a` und `person_b` Mahlzeiten. Bei `shared`-Slots: gleiches Gericht (`name` identisch), aber individuelle Zutatenmengen, kcal & Makros pro Person. Harte Regel: Allergien BEIDER ausschließen; No-Gos bei shared meals vermeiden.
4. Schreibe ZWEI `nutrition_plans` (Status draft), verknüpfe sie über `partner_plan_id`; bei shared meals beide `nutrition_plan_meals` per `partner_meal_id` koppeln und `is_shared=true`
5. Auto-Shoppinglisten: individuelle Liste pro Plan + zusätzliche `partner_combined`-Liste, die Zutaten summiert (gleiche Einheit → addieren; sonst nebeneinander listen)

## 4. Gemeinsame Einkaufsliste

In `src/routes/nutrition.shopping.tsx`:
- Dropdown: „Meine Liste" / „Partner-Liste" / „Gemeinsame Liste"
- Nur sichtbar wenn Partner-Kopplung existiert
- Aggregation in `shopping-list-engine.server.ts` erweitern: Funktion `generateCombinedShoppingList(planAId, planBId)`

## 5. Kundenansicht für Partner-Mahlzeiten

In `PlanContentView.tsx` / `nutrition.index.tsx`:
- Bei `is_shared=true` Mahlzeit als „🍽️ Gemeinsam mit {Partner-Name}" labeln
- Aufklappbar: „Deine Portion" (eigene Zutaten/Makros) + „Partnerportion" (vom verknüpften Meal geladen)

## Technische Details (für mich beim Bauen)

- **Dateien neu:** `src/lib/partner.functions.ts`, `src/lib/partner-nutrition-plan-ai.functions.ts`, `src/components/bodyfuel/PartnerLinkCard.tsx`
- **Dateien geändert:** `src/routes/coach.customers.$userId.tsx`, `src/components/bodyfuel/PlanManagementCard.tsx`, `src/components/bodyfuel/PlanContentView.tsx`, `src/routes/nutrition.shopping.tsx`, `src/lib/shopping-list-engine.server.ts`
- **Migration:** neue Tabelle + GRANTs + RLS-Policies via `has_role('coach')` und Eigentümer-Check; Spalten-Erweiterungen für `nutrition_plans`, `nutrition_plan_meals`, `shopping_lists`
- Bestehende ISSN-Carb-Cycling-Logik wird wiederverwendet (kein Doppelcode), 50-kcal-Rundung greift weiter
- Auto-Sync nach Aktivierung: `transitionPlanStatus` aktiviert ggf. den Partner-Plan mit, damit beide Pläne synchron live gehen — Targets je Person bleiben getrennt

## Fragen vor dem Bauen

1. Soll bei „Gemeinsamen Plan erstellen" der **Partner-Plan automatisch beim Partner ebenfalls als Draft landen** (Coach aktiviert dann beide), oder direkt für beide aktivieren?
2. Wenn Person A schon einen aktiven Plan hat: soll der beim Generieren eines Partner-Plans automatisch archiviert werden (so wie bei Solo-Plänen heute)? Ich würde **ja** vorschlagen.
3. Reihenfolge OK so (Schritte 1–5 nacheinander, je ein Commit) oder willst du etwas zuerst?
