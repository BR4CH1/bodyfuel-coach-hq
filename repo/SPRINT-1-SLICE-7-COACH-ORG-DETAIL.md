# Sprint 1 · Slice 7 · Coach Organization Detail

## Ziel

Die 2.216 Zeilen große Organisationsroute in klar abgegrenzte Fachkomponenten zerlegen, ohne den bestehenden Coach-Flow oder die URL-Hash-Navigation zu verändern.

## Ergebnis

### Hauptdatei

`src/routes/coach.teams.$orgId.tsx`

- vorher: 2.216 Zeilen
- nachher: 1.550 Zeilen
- Training, Ernährung und Aufgaben werden jetzt als eigenständige Feature-Komponenten eingebunden
- nicht mehr benötigte Schedule-, Picker- und Task-Imports wurden aus der Route entfernt

### Neues Feature-Modul

```text
src/features/coach-org-detail/
├── components/
│   ├── TrainingTab.tsx
│   ├── NutritionScheduleCard.tsx
│   ├── TasksTab.tsx
│   ├── ScheduleEditor.tsx
│   └── OrgDetailPrimitives.tsx
├── lib/
│   ├── schedule.logic.ts
│   └── __tests__/
│       └── schedule.logic.test.ts
└── types.ts
```

### Training

`TrainingTab.tsx` bündelt jetzt:

- Team-, Gruppen- und Athletenauswahl
- Laden der passenden Trainings-Schedules
- Speichern auf Team-, Gruppen- oder Athletenebene
- Verknüpfung zum individuellen Trainingsplan-Builder
- React-Query-Invalidierung nach Änderungen

### Ernährung

`NutritionScheduleCard.tsx` bündelt jetzt:

- Team-, Gruppen- und Athletenauswahl
- Laden und Speichern der Ernährungs-Schedules
- Verknüpfung zum individuellen Ernährungsplan-Builder
- gemeinsame Nutzung des Schedule-Editors

### Aufgaben

`TasksTab.tsx` bündelt jetzt:

- Datums-, Team- und Statusfilter
- organisationsweite, teamweite, gruppenweite und individuelle Aufgaben
- Auflösung der Athleten einer Positionsgruppe
- Verknüpfung zu Trainings- oder Ernährungsplan-Buildern
- Darstellung der Tagesaufgaben

### Gemeinsame Schedule-Logik

`src/features/coach-org-detail/lib/schedule.logic.ts`

- erzeugt sieben editierbare Wochentage
- normalisiert Zeitangaben auf `HH:mm`
- erstellt einen stabilen Schedule-Key
- serialisiert aktive und bereits vorhandene deaktivierte Einträge

## Zusätzliche Stabilisierung

- `ScheduleEditor` aktualisiert State nicht mehr während des Renderings.
- Bei einem Wechsel des Teams oder Schedule-Inhalts wird der Editor kontrolliert neu initialisiert.
- Die zuvor angelegte, aber nicht verwendete Task-Engine-Mutation im Trainingstab wurde entfernt.
- `Card` und `Empty` liegen jetzt als gemeinsame UI-Primitives im Feature-Modul.
- Gemeinsame Typen für Teams, Schedule-Einträge und Editor-Zeilen wurden eingeführt.

## Prüfungen

- ESLint für alle neuen Coach-Org-Detail-Dateien: bestanden
- gezielter TypeScript-Check inklusive importierter Abhängigkeiten: bestanden
- esbuild Syntax-/Importprüfung der Route und aller neuen Dateien: bestanden
- neue Schedule-Tests: 3/3 bestanden
- Nutrition-Tracker-Regressionstests: 5/5 bestanden
- Plan-Builder-Regressionstests: 4/4 bestanden
- vollständiger projektweiter TypeScript-Check: innerhalb von 120 Sekunden nicht abgeschlossen
