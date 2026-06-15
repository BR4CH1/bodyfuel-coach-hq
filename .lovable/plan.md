# BODYFUEL Strength Check

Pflicht-Krafttest (7 Übungen) vor Trainingsstart, danach automatisch alle 6 Wochen. Liefert Score pro Muskelgruppe + Gesamt, fließt in Ranking & später KI ein.

## 1. Datenbank

Migration legt 3 neue Tabellen + Score-Funktion an (alle mit GRANTs + RLS scoped auf `auth.uid()`, Coach via `has_role`).

- `strength_checks`
  - `user_id`, `performed_at` (date), `status` (`draft`/`completed`)
  - Score-Spalten: `score_lower`, `score_push`, `score_pull`, `score_core`, `score_total` (0–100)
  - `notes` (frei)
- `strength_check_results` (1 Zeile pro Test)
  - `check_id`, `test_key` (enum: `leg_press`, `leg_curl`, `chest_press`, `shoulder_press`, `lat_pulldown`, `cable_row`, `plank`)
  - `weight_kg` (nullable für Plank), `reps` (nullable), `duration_seconds` (nur Plank)
  - `rpe` (1–10), `pain_note` (text), `e1rm_kg` (generated)
- `strength_check_reminders` (für „in 30 Tagen erinnern" / „nach 42 Tagen wieder fällig")
  - `user_id`, `due_at`, `kind` (`upcoming`/`due`), `sent_at`

Trigger `process_strength_check` (on `status='completed'`):
1. Berechnet relative Stärke = `e1rm / körpergewicht` (Plank: Sekunden direkt).
2. Mapped auf 0–100 via Tabelle (m/w, Übung) → Score pro Test.
3. Aggregiert: `lower = avg(leg_press, leg_curl)`, `push = avg(chest_press, shoulder_press)`, `pull = avg(lat_pulldown, cable_row)`, `core = plank`. `total = round(avg(4))`.
4. Schreibt Punkte in `performance_points`:
   - +25 „Strength Check absolviert"
   - +10 wenn `total` > vorheriger `total`
   - +5 pro Kategorie mit neuer PR
   - +20 wenn 2 Checks in laufendem Quartal vollständig
5. Plant neue Erinnerung in 30/42 Tagen.

## 2. Server-Funktionen (`src/lib/strength-check.functions.ts`)

Alle mit `requireSupabaseAuth`.

- `getMyStrengthStatus()` → `{ last: {date, total, scores}, next_due_at, has_ever_completed, is_overdue }`
- `startStrengthCheck()` → erzeugt `draft`
- `saveStrengthResult({ check_id, test_key, weight_kg, reps, duration_seconds, rpe, pain_note })`
- `completeStrengthCheck({ check_id })` → setzt `completed`, Trigger rechnet Scores
- `getMyStrengthHistory()` → Liste aller Checks für Diagramme
- Coach: `getCustomerStrengthOverview({ user_id })` → letzter Check, Trend, schwächste/stärkste Gruppe, alle Schmerz-Notizen

## 3. UI

### Neue Route `/training/strength-check` (Kunde)
- Intro mit allen Sicherheitshinweisen aus dem Briefing (kein 1RM, RPE-Erklärung, etc.)
- 7-Schritt-Wizard (eine Test-Karte pro Übung): Gewicht/Wdh./RPE-Slider/Schmerz-Notiz. Plank-Karte hat nur Zeit + RPE + Notiz.
- Abschluss-Screen: Donuts pro Score (Unterkörper/Push/Pull/Core/Gesamt) + Ampel 🟢🟡🔴 pro Muskelgruppe + Vergleich zu letztem Check (% Veränderung).

### Dashboard-Karte (Kunde)
- Wenn noch nie absolviert: Rote Pflicht-Karte „Starte deinen Strength Check, bevor du loslegst".
- Wenn `is_overdue`: gelbe Karte „Dein Strength Check ist wieder fällig".
- Wenn `due in <= 12d`: dezente Erinnerung mit Datum.

### Training-Seite (Kunde)
- Falls Strength Check fehlt, oben blockierende Karte mit CTA, statt Tracker direkt anzuzeigen.

### Coach-Sicht (`coach.customers.$userId`)
- Neue Sektion „Strength Check": Datum, alle Werte, RPE, Schmerz-Hinweise rot markiert, Score-Donuts, Trend-Linie über alle Checks, Hervorhebung „Schwächste / Stärkste Gruppe", Dysbalance-Hinweis (Differenz > 20).

### Fortschritts-Charts
- Linien-Chart `total` über Zeit (recharts) – nutzt korrigierte `var(--gold)`-Farben.
- Balken pro Kategorie für letzten vs. vorherigen Check.

## 4. Erinnerungen

- 30 Tage nach Completion: Reminder-Eintrag `kind=upcoming` → Dashboard-Banner + bestehender `trial-reminders`-Cron sendet zusätzlich Mail (falls ausgebaut – sonst nur In-App).
- 42 Tage: Strength Check erscheint wieder als offene Pflicht-Aufgabe.

## 5. Ranking

Punkte fließen über `performance_points` (bestehendes System) → automatische Anzeige in `Erfolge`/`PointsBreakdownCard`. Neue `kind`-Werte: `strength_check_done`, `strength_score_up`, `strength_pr`, `strength_quarter_bonus`.

## 6. Scoring-Referenz (im Trigger als Konstanten)

Basis: körpergewichts-relative Schwellen je Übung & Geschlecht (vereinfachte „Strength Standards"-ähnliche Tabelle). Beispiel Beinpresse Männer: 1.0×KG → 30, 1.5× → 50, 2.0× → 70, 2.5× → 85, 3.0× → 100. Plank: 30s→40, 60s→70, 120s→100. Wenn Geschlecht fehlt → männliche Skala minus 10 %.

## Nicht enthalten (bewusst out of scope)

- Tatsächliche KI-Generierung von Trainingsplänen auf Basis des Scores (nur Daten-Speicherung + spätere Nutzung vorbereitet).
- E-Mail-Templates für die 30-Tage-Erinnerung (nur In-App-Banner; Mail kann bei Bedarf nachgereicht werden).
- Veränderung des bestehenden Trial-Plans/PDF-Parsings.

## Technische Reihenfolge

1. Migration (Tabellen, RLS, GRANTs, Trigger, Scoring-Funktion).
2. Server-Funktionen.
3. Wizard-Route + Dashboard-/Training-Banner.
4. Coach-Sektion.
5. Verifizieren: Test mit Demo-User, Check Scores & Punkte.
