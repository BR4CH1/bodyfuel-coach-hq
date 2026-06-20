## Coaching Dashboard 2.0 – Aufgaben-Inbox, Coach Radar & Kundenstatus

Großes Feature mit mehreren neuen Bereichen. Ich baue es schrittweise auf bestehender Infrastruktur auf (`coach-alerts.functions.ts`, `coach-smart-insights.functions.ts`, `CoachActionAlertsCard.tsx`).

### 1. Backend – neue Server Functions (`src/lib/coach-radar.functions.ts`)

- **`getCoachRadar`**: Berechnet pro Kunde einen Status (`green` / `yellow` / `orange` / `red`) basierend auf:
  - Plan-Status (aktiv/abgelaufen/läuft bald aus)
  - Gewichtstrend (>1,5 %/Woche Verlust, Stagnation 14d, Anstieg trotz Abnehmziel)
  - Kalorien-Adhärenz (<80 % / >120 % an 3 von 7 Tagen)
  - Protein-Adhärenz (<75 % an 3 von 7 Tagen)
  - Wasser (<2 L an 4 Tagen)
  - Training (7 Tage kein Training, Frequenz unter Vorgabe)
  - Aktivität (Ø Schritte <5.000, 2-Wochen-Trend)
  - Check-in-Verzug
  - Liefert Kundenliste pro Bucket + aggregierte Counts.

- **`getCoachTaskInbox`**: Vereinheitlicht offene Aufgaben aus mehreren Quellen zu einem Inbox-Feed mit Priorität (`critical` / `important` / `info`):
  - Kritisch: kein aktiver Ernährungs-/Trainingsplan, Plan endet ≤3d, extreme Gewichtsänderung, manuelle Freigaben
  - Wichtig: Plan endet ≤7d, Check-in überfällig (>7d), fehlende Fortschrittsfotos (>21d), Inaktivität (>10d ohne Daten)
  - Info: Neuer Kunde (<7d), erstes Gewicht, neuer Check-in, abgeschlossene Challenge
  - Nutzt vorhandene `coach_alert_resolutions` Tabelle für „erledigt/ignoriert".

### 2. UI-Komponenten

- **`CoachRadarCard.tsx`** (neu): Drei klickbare Buckets (🔴 Sofort handeln / 🟠 Beobachten / 🟢 Auf Kurs) mit Counts. Klick öffnet ausklappbare Kundenliste mit Grund + Link zum Kundenprofil.

- **`CoachTaskInboxCard.tsx`** (neu, ersetzt Logik von `CoachActionAlertsCard`): 
  - Filter-Pills (Alle / 🔴 / 🟠 / 🟢), Counts pro Kategorie
  - Aufgaben mit Icon, Kundenname, Beschreibung, „Erledigt/Ignorieren"-Buttons
  - Collapsible „Verlauf" für erledigte Aufgaben (7 Tage)
  - Erledigte standardmäßig ausgeblendet

- **`CoachDashboardSummary.tsx`** (neu): Zusammenfassungs-Strip ganz oben mit 6 Kacheln:
  🔴 Sofort handeln · 🟠 Beobachten · 🟢 Auf Kurs · 📋 Offene Aufgaben · 📅 Pläne laufen aus · ⚠️ Aktive Warnungen

- **`CustomerStatusBadge.tsx`** (neu, wiederverwendbar): Zeigt Kundenstatus (🟢🟡🟠🔴) – wird in Dashboard, Kundenliste und Kundenprofil eingebunden.

### 3. Integration

- **`src/routes/coach.index.tsx`**: Neue Reihenfolge oben → Summary, Radar, Task-Inbox. Bestehende Karten darunter behalten.
- **`src/routes/coach.customers.index.tsx`**: `CustomerStatusBadge` neben jedem Kundennamen.
- **`src/routes/coach.customers.$userId.tsx`**: `CustomerStatusBadge` im Header.

### Technisch

- Keine DB-Migration nötig – alle Berechnungen on-the-fly aus existierenden Tabellen (`body_measurements`, `food_entries`, `water_logs`, `training_set_logs`, `weekly_checkins`, `nutrition_plans`, `coach_alert_resolutions`, `daily_checks`).
- React Query mit `staleTime: 60s`; eine gemeinsame Query für Radar+Inbox+Summary, damit nur 1 Backend-Roundtrip.
- Bestehende `resolveCoachAlert`/`unresolveCoachAlert` werden für die neue Inbox wiederverwendet (gleiche `coach_alert_resolutions` Tabelle).
- `CoachActionAlertsCard.tsx` bleibt als Fallback erhalten, wird aber aus dem Dashboard entfernt.

### Reihenfolge

1. `coach-radar.functions.ts` (Radar + Inbox + Summary in einer Datei)
2. `CustomerStatusBadge.tsx`
3. `CoachDashboardSummary.tsx`, `CoachRadarCard.tsx`, `CoachTaskInboxCard.tsx`
4. `coach.index.tsx` umbauen
5. Badge in Kundenliste + Kundenprofil einbinden
