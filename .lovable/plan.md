## Ziel

- Reihenfolge im Coach-Bereich klar durchziehen: **Verein → Team → Athleten → Athletenprofil**.
- Klick auf einen Athleten öffnet keine „zweite Übersicht“ mehr, sondern eine Tab-Detailseite.
- Bestehende Route, bestehende Datenquelle, bestehende Rollenprüfung — nichts parallel neu bauen.

## 1. Team-Filter direkt oben in der Athletenliste

Datei: `src/components/organizations/AthletesTab.tsx`

- Chip-Reihe ergänzen: `[ Alle ] [ Seniors ] [ Juniors ] …`, dynamisch aus dem bereits übergebenen `teams`-Array.
- Aktiver Chip setzt lokalen State, der wie heute die Athletenliste filtert.
- Externer `teamFilter` (aus Team-Card-Klick) bleibt unterstützt und wird beim Wechseln des Chips überschrieben.
- Bestehender „Gefiltert nach Team“-Hinweis bleibt oder entfällt zugunsten der Chips (eine Anzeige, nicht zwei).

## 2. Athletendetail-Route auf Tabs umstellen

Route bleibt: `/coach/teams/$orgId/athletes/$userId`. Keine neuen Server-Functions — alle Tabs lesen aus dem bereits vorhandenen `getCoachAthleteDetail` (Datei `src/lib/organizations/coach-athlete-drilldown.functions.ts`, 545 Zeilen, prüft Rolle `coach` bzw. `staff_assignments`).

Die aktuelle Datei `src/routes/coach.teams.$orgId.athletes.$userId.tsx` (873 Zeilen) wird ausgedünnt: Query + Berechtigung + Tab-Umschalter, sonst nur noch Komposition.

## 3. Neue Komponenten (aus bestehendem Code extrahiert)

Verzeichnis: `src/components/coach/athlete/`

- `AthleteDetailHeader.tsx` — Name, Team, Position, Trikot, Alter/Größe/Gewicht, Statuschip (aus `Header` + `Initials`).
- `AthleteQuickActions.tsx` — „Aufgabe erstellen“ / „Nachricht“ / „Notiz“ (Buttons; wo Feature noch nicht existiert: deaktiviert mit „bald verfügbar“ – kein Fake-Verhalten).
- `AthleteOverviewTab.tsx` — Coach Summary, Coach Radar, kompakter Pulse; „Letzte Aktivitäten“ aus `training.timeline` (wenn vorhanden).
- `AthleteTasksTab.tsx` — Nutzt `training.timeline` (das sind die Org-Tasks des Athleten). Filter offen/erledigt/ausgelassen; „Neue Aufgabe“ als Placeholder-Button bis Backend steht.
- `AthleteCheckinsTab.tsx` — Aktuell hat `CoachAthleteDetail` keinen Check-in-Feed. Solange keine echten Daten: klarer Leerzustand „Noch keine Check-ins vorhanden.“ Kein Fake. Weight-Serie darf als Body-Verlauf bleiben.
- `AthletePerformanceTab.tsx` — Zeigt `strength` + verlinkt auf den bereits existierenden Coach-Bulls-Performance-Bereich für Verifikation. Kein Duplikat der Verifikations-UI.
- `AthleteTrainingTab.tsx` — TrainingActivity + `TrainingPlanManagementCard`.
- `AthleteNutritionTab.tsx` — MacroTargets, NutritionTargetsEditor, PlanManagementCard.
- `athlete-tab-shared.tsx` — kleine Bausteine (Section, TinyStat, TrendChip, MetricRow, MiniLine, TinyMetric), die von mehreren Tabs benutzt werden.

## 4. Route-Datei nach Refactor (grob)

```text
coach.teams.$orgId.athletes.$userId.tsx  (~180 Zeilen statt 873)
  ├─ Query getCoachAthleteDetail (unverändert)
  ├─ BackLink → /coach/teams/$orgId
  ├─ AthleteDetailHeader
  ├─ AthleteQuickActions
  ├─ Tab-Umschalter: übersicht | aufgaben | check-ins | performance | training | ernährung
  └─ <ActiveTab data={data} orgId={orgId} userId={userId} />
```

Tab-State über `useSearch`/`useState` (search-param `tab`, damit teilbar und beim Zurücknavigieren stabil).

## 5. Rollen- und Datenabsicherung

- Route-Seite: sichtbar nur, wenn der Coach-Menüpunkt/Team-Cockpit erreichbar ist (bestehende Gates in `/coach` und `/coach/teams` bleiben unverändert).
- Datenzugriff: `getCoachAthleteDetail` prüft weiterhin serverseitig `has_role('coach')` **oder** aktiven Eintrag in `staff_assignments` für die `orgId`. Spieler kommen dort nicht durch — kein zusätzlicher Client-Check nötig.
- Ein Coach sieht nur Athleten der Teams, für die er via `staff_assignments`/Membership berechtigt ist — bleibt wie bisher.

## 6. Was NICHT in diesem Turn passiert (bewusst, wie geantwortet)

- Kein neuer Coach-Aufgaben-Editor, kein Check-in-Feed-Backend, keine Performance-Verifikations-UI direkt im Athletenprofil, keine Ernährungs-Compliance-Berechnung. Diese Tabs bekommen echte Daten dort wo sie heute schon vorliegen; sonst sauberen Leerzustand. Ausbau der Actions je Tab folgt in eigenen Turns.

## 7. Kurze Nachweis-Liste, die ich am Ende poste

- Neue Navigation: Chips oben in `AthletesTab`.
- Athletenprofil-Route: `/coach/teams/$orgId/athletes/$userId` (unverändert).
- Tabs: Übersicht · Aufgaben · Check-ins · Performance · Training · Ernährung.
- Datenquelle: einzige `getCoachAthleteDetail`, alle Tabs teilen sich diese Daten.
- Rollenabsicherung: Server-Function-Guard (`has_role('coach')` oder `staff_assignments`), keine parallele Logik.
