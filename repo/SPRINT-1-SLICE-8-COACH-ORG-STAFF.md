# Sprint 1 · Slice 8 · Coach Organization Staff

## Ziel

Den kompletten Staff-Bereich aus der weiterhin großen Organisationsroute herauslösen und Rollen-, Berechtigungs-, Einladungs- und Speicherlogik klar voneinander trennen.

## Ergebnis

### Hauptdatei

`src/routes/coach.teams.$orgId.tsx`

- vorher: 1.550 Zeilen
- nachher: 1.018 Zeilen
- Staff-Abfragen, Mutationen, Modals und Berechtigungslisten liegen nicht mehr inline in der Route
- die Route bindet den Bereich nur noch über `StaffTab` ein
- die Team-Übergabe an den Staff-Bereich verwendet jetzt den gemeinsamen `OrgTeam`-Typ

### Neue Staff-Komponenten

```text
src/features/coach-org-detail/
├── components/
│   ├── StaffTab.tsx
│   ├── StaffRow.tsx
│   ├── AddStaffModal.tsx
│   └── PermissionChecklist.tsx
├── hooks/
│   └── useOrgStaff.ts
└── lib/
    ├── staff.logic.ts
    └── __tests__/
        └── staff.logic.test.ts
```

### `StaffTab`

Bündelt jetzt:

- Staff-Liste und Ladezustand
- offene Einladungen
- Hinzufügen-Dialog
- Aktualisieren und Entfernen von Mitarbeitern
- Zurückziehen offener Einladungen
- sichtbares Erfolgs- und Fehlerfeedback

### `useOrgStaff`

Kapselt jetzt sämtliche Staff-Datenzugriffe:

- Laden von Staff-Profilen
- Laden und Filtern offener Einladungen
- Hinzufügen bestehender BODYFUEL-User oder Erzeugen einer Einladung
- Aktualisieren von Zuständigkeit und Berechtigungen
- Entfernen aus dem Verein oder vollständige Account-Löschung
- React-Query-Invalidierung nach Mutationen

### `StaffRow`

- Zuständigkeit und Berechtigungen werden lokal editiert
- Editor-State wird kontrolliert aktualisiert, wenn neue Serverdaten eintreffen
- bei einem Speicherfehler bleibt der Editor geöffnet
- Account-Löschung und reine Vereinsentfernung bleiben klar getrennt

### `AddStaffModal`

- Preset-Auswahl ist vollständig typisiert
- E-Mail-Adressen werden vor dem Absenden normalisiert
- Rollen-Presets und individuelle Berechtigungen bleiben kombinierbar
- Zugriff und fehlende Berechtigungen werden in einer Zusammenfassung angezeigt

### Gemeinsame Berechtigungslogik

`src/features/coach-org-detail/lib/staff.logic.ts`

- validiert und dedupliziert Berechtigungslisten
- schaltet Berechtigungen ohne Mutation des Ausgangsarrays um
- berechnet fehlende Berechtigungen
- filtert offene Einladungen
- normalisiert E-Mail-Adressen
- erzeugt konsistente Erfolgsnachrichten

### Client-sichere Rollen-Presets

Neu:

`src/lib/organizations/staff-presets.ts`

Die Staff-Presets lagen vorher zusammen mit Server Functions in `operating-loop.functions.ts`. Sie wurden in ein reines Shared-Modul verschoben. Dadurch müssen UI und Tests nicht mehr das große Server-Functions-Modul importieren. Aus Kompatibilitätsgründen werden die Konstanten dort weiterhin re-exportiert.

## Typisierung

Neu ergänzt wurden Typen für:

- Staff-Mitglieder
- Staff-Einladungen
- Update-Patches
- Add-Staff-Payloads
- Mutationsergebnisse
- Erfolgs- und Fehlerfeedback

Die neu angelegten Staff-Dateien enthalten keine expliziten `any`-Typen.

## Prüfungen

- ESLint für alle neuen Staff-Dateien und `staff-presets.ts`: bestanden
- bestehende Route mit deaktivierten historischen `any`- und Prettier-Regeln geprüft: keine zusätzlichen ESLint-Fehler
- gezielter TypeScript-Check der neuen Staff-Dateien: bestanden
- esbuild Syntax-/Importprüfung der vollständigen Organisationsroute: bestanden
- neue Staff-Logik-Tests: 5/5 bestanden
- Schedule-Regressionstests: 3/3 bestanden
- Nutrition-Tracker-Regressionstests: 5/5 bestanden
- Plan-Builder-Regressionstests: 4/4 bestanden
- insgesamt: 17/17 Tests bestanden
- vollständiger projektweiter TypeScript-Check: innerhalb von 120 Sekunden nicht abgeschlossen
