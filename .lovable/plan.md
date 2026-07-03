## Ziel

Pro Kunde beliebig viele Ernährungsplan-Zeiträume speichern, wochenweise anhängen können, ohne bestehende Pläne zu überschreiben. Bestehende Anzeigen bleiben funktionsfähig.

## Vorhandene Struktur (nutze ich weiter)

Die Tabelle `nutrition_plans` unterstützt bereits `scheduled_start_date`, `scheduled_end_date`, `weeks_count`, `status` (draft/approved/published/active/archived), `plan_type`. Es gibt keine harte `current_plan_id` / `next_plan_id` — Rotation läuft heute schon über Datumsbereich. Kein Schema-Umbau nötig.

Problem heute: `saveCoachNutritionPlanDraft` archiviert beim Import **alle** draft/approved/published-Pläne des Kunden. Genau das brechen wir auf.

## Umsetzung

### 1. Import-Modi (Server)

Neuer Parameter `mode` in `saveCoachNutritionPlanDraft`:

- `new_plan` (Default für ersten Plan) — neuer Plan, keine Archivierung anderer aktiver Pläne
- `append_week` (Default wenn Zielplan angegeben) — hängt Tage als neue Woche an bestehenden Plan; `weeks_count` und `scheduled_end_date` werden erweitert
- `replace_week` — ersetzt Tage mit gegebener `week_number` im Zielplan
- `replace_plan` — archiviert einen bestimmten `target_plan_id` und ersetzt ihn
- Kein pauschales „archiviere alle Pläne" mehr.

Zusätzlicher Pre-Check-Server-Fn `checkNutritionPlanConflict({ client_id, start_date, end_date })`: liefert überlappende Pläne zurück, damit UI die Rückfrage stellen kann („Zeitraum belegt — Abbrechen / Zeitraum ersetzen / Trotzdem zusätzlich").

### 2. Historie-Fetcher

`listCustomerNutritionPlans({ client_id })` — Coach-only, liefert alle Pläne mit `id, title, status, source, generated_by, scheduled_start_date, scheduled_end_date, weeks_count, created_at`, sortiert nach `scheduled_start_date DESC`. Server-seitig in drei Buckets aufgeteilt: `current` (Heute ∈ Zeitraum), `upcoming` (Start > heute), `past` (Ende < heute).

Kundenseitig: `listMyPublishedNutritionPlans()` — nur `status in ('active','published')`, gruppiert nach Plan und `week_number`.

### 3. UI Coach — Kundenprofil `/coach/customers/$userId`

Neue Sektion `NutritionPlanHistoryCard`:

- Aktueller Plan (großer Block, Link „Öffnen")
- Kommende Pläne (Liste)
- Vergangene Pläne (collapsible, letzte 10)
- Aktionen pro Zeile: Öffnen · Als aktiv setzen · Archivieren

### 4. UI Coach — Import (`coach.import-plan.tsx`)

Vor dem Speichern:

- Dropdown „Speichern als" mit den 4 Modi
- Wenn `append_week` / `replace_week`: Select mit bestehenden Plänen des Kunden (aus Historie-Fetcher) + Wochennummer
- Nach Klick auf Speichern: automatischer Konflikt-Check; bei Treffer Bestätigungs-Dialog

Default: wenn Kunde bereits einen aktuellen Plan hat → `append_week`, sonst `new_plan`.

### 5. Kundenansicht Ernährung

`PlansView` / `nutrition.index.tsx` bekommt Zusatz „Alle Wochen" — Tabs `Woche 1..N` innerhalb eines Plans, plus Auswahl bei mehreren veröffentlichten Plänen. Nicht disruptiv: aktueller Plan-Reader bleibt Default.

### 6. Sicherheits-Netz

- `saveCoachTrainingPlanDraft` bleibt unverändert (User-Anfrage betrifft nur Ernährung).
- Keine Migration nötig; RLS auf `nutrition_plans` bleibt.
- Der Zeitraum-Check nutzt Datumsüberlappung `[start, end]` — Archivierte werden ignoriert.

## Technische Details

- Server: `src/lib/coach-plan-import.functions.ts` (Signatur erweitern), `src/lib/coach-plan-history.functions.ts` (neu, Historie + Konflikt-Check + Status-Aktionen).
- UI: `src/components/bodyfuel/CoachNutritionPlanHistoryCard.tsx` (neu), `src/routes/coach.import-plan.tsx` (Modi-Auswahl + Konflikt-Dialog), `src/routes/coach.customers.$userId.tsx` (Historie-Card einbinden), `src/components/bodyfuel/PlansView.tsx` (Wochen-Tabs, falls mehrere Pläne).
- Types: nach Server-Änderung wird `types.ts` nicht angefasst — Schema bleibt gleich.

## Out of Scope

- Trainingsplan-Historie (analog machbar, aber nicht angefragt).
- Automatische Wochen-Rotation / Cron-Anpassung (bestehende `plan-rotation.ts` funktioniert weiter über Datumsbereiche).
