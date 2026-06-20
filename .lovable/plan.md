
## Was ich baue

### 1. Smart-Filter in Kundenliste (`src/routes/coach.customers.index.tsx`)
- Neuer Filter-Chip **`SMART (n)`** zwischen `BULLS` und `TRIAL`
- Zählt alle aktiven Kunden mit `package = 'smart'`
- Klick filtert die Liste auf Smart-Kunden

### 2. Autopilot-Fix für Smart Onboarding
**Bug:** `completeSmartOnboarding` triggert nur den **Trainings**-Plan. Der Ernährungsplan wird nie automatisch generiert — deswegen ist bei Manuel nichts da.

**Fix in `src/lib/smart-onboarding.functions.ts`:**
- Nach dem Training-Generator zusätzlich den Nutrition-Generator (`generateAiNutritionPlanDraft`-Kernlogik) aufrufen
- Beide Drafts automatisch auf `status='active'` setzen mit korrektem `scheduled_start_date` (heute) und `scheduled_end_date` (heute + 28 Tage Nutrition / heute + 42 Tage Training)
- Wenn einer der beiden Generatoren fehlschlägt, wird der andere trotzdem aktiviert (best effort, kein Block)

### 3. Manuelle Verlängerung (Smart-Kunde)
**Server-Funktionen** (`src/lib/smart-renewal.functions.ts` neu):
- `renewSmartNutritionPlan` — nur erlaubt wenn aktueller Plan in den letzten 7 Tagen abläuft ODER bereits abgelaufen. Generiert neuen 4-Wochen-Plan, archiviert alten, setzt neuen auf `active`.
- `renewSmartTrainingPlan` — analog für 6 Wochen. **Sonderfall:** wenn letzter `strength_checks` Eintrag > 28 Tage alt ist → blockiert, zwingt Strength-Check zuerst.
- `canRenewSmart` (GET) — liefert für Nutrition & Training: `{ can_renew, blocked_by_strength_check, days_until_end, current_end_date }`

**Frontend** in `src/routes/tracker.app.tsx` (oder dort wo Smart-Nutzer landen):
- Neue Komponente `SmartRenewalCard` — nur sichtbar wenn `package='smart'` UND mindestens ein Plan läuft in ≤7 Tagen aus
- Zwei Buttons: „Ernährungsplan verlängern (4 Wochen)" / „Trainingsplan verlängern (6 Wochen)"
- Bei Training-Block: Button-Label „Erst Strength-Check durchführen" → Link zu `/strength-check`

### 4. Brachi-Gate Update
Da Smart-Autopilot jetzt korrekt läuft, bleibt die Brachi-Test-Sperre für das **Upgrade-Popup** (Free → Smart) wie sie ist — die wurde im vorigen Schritt bereits so gebaut. Die neue Verlängerungs-Funktion ist für **alle Smart-Kunden** freigeschaltet (kein Test-Gate).

## Technische Details

**Tabellen genutzt:** `nutrition_plans` (`scheduled_end_date`, `status`, `plan_type`), `customer_packages` (Filter), `strength_checks` (Block-Check), `smart_nutrition_profile`.

**Neue Migration:** keine. `scheduled_end_date` existiert bereits.

**Bestehende Manuel-Daten:** Nach Plan-Akzeptanz triggere ich für Manuel manuell die neue Autopilot-Logik einmal, damit er sofort einen Plan hat (sobald er das Onboarding abschließt — ohne Onboarding-Daten kein Plan möglich).

**Smart-Filter-Zählung:** ich nutze den vorhandenen `listCustomers` Datafetch — kein neuer Server-Call.

## Was ich NICHT anfasse

- Stripe-Live-Webhook-Problem (separates Thema)
- Bestehendes Smart-Onboarding-UI
- Coach-Detailseite eines Kunden

## Geschätzter Aufwand
~6 Dateien, 1 neue Datei, kein Schema-Change.
