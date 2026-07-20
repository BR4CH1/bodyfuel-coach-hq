# Sprint 1 – Slice 14: Coach-Organisation Controller & Orchestrierung

## Ziel

Die letzte große Organisationsroute sollte nicht länger Datenzugriff, URL-Hash-Navigation,
Berechtigungen, KPI-Berechnung und sämtliche UI-Bereiche gleichzeitig verantworten.

## Ergebnis

- `src/routes/coach.teams.$orgId.tsx`: **487 → 12 Zeilen**
- Die Route enthält nur noch Route-Definition, Parameterauflösung und Page-Aufruf.
- Lade-, Fehler- und Leermeldungen sind explizit getrennt.
- Unbekannte URL-Hashes fallen kontrolliert auf `cockpit` zurück, statt eine leere Seite zu erzeugen.
- Teamfilter werden automatisch entfernt, wenn das ausgewählte Team nicht mehr verfügbar ist.
- Rollen- und Berechtigungslogik ist zentralisiert.
- Die Organisationsansicht enthält keine neuen expliziten `any`-Typen.

## Neue Struktur

```text
src/features/coach-org-detail/
├── components/
│   ├── CoachExperienceNotice.tsx
│   ├── CoachOrgDetailPage.tsx
│   ├── OrgDetailHeader.tsx
│   ├── OrgDetailKpiGrid.tsx
│   ├── OrgDetailTabContent.tsx
│   ├── OrgOverviewTab.tsx
│   └── OrgQuickAccess.tsx
├── hooks/
│   └── useCoachOrgDetailController.ts
└── lib/
    ├── org-detail.logic.ts
    └── __tests__/
        └── org-detail.logic.test.ts
```

## Verantwortlichkeiten

### Controller

`useCoachOrgDetailController` verwaltet:

- Organisationsabfrage
- Hash-basierte Tab-Navigation
- Teamfilter
- Join-Link-Dialogzustand
- Feature-Flags
- Terminologie
- Rollen-/Berechtigungsableitung
- gefilterte KPI-Anzeige

### Präsentation

- `OrgDetailHeader`: Organisation, Lizenz und Logo
- `OrgDetailKpiGrid`: Athleten, Compliance, Onboarding und Teams
- `OrgQuickAccess`: modulabhängige Schnellzugriffe
- `OrgOverviewTab`: Challenge, Onboarding und Aktivitäten
- `OrgDetailTabContent`: zentrale Tab-Orchestrierung
- `CoachOrgDetailPage`: Seitenkomposition und Statusdarstellung

## Prüfungen

- ESLint für alle neuen und geänderten Dateien: bestanden
- TypeScript (`npm run typecheck`): bestanden
- Validator-Guard: 387 aktuelle `.validator()`-Aufrufe, 0 veraltete Aufrufe
- Build-Memory-Guard: 4096 MB bestätigt
- Vitest: **106/106 Tests bestanden**
- Neue Controller-/Logiktests: **5/5 bestanden**
- Client-Produktionsbundle: erfolgreich in ca. 28 Sekunden
- Vollständiger Build: Der nachgelagerte SSR/Nitro-Schritt lief auch nach 10 Minuten noch weiter und wurde vom Prüfzeitlimit beendet. Das bleibt ein separater offener Build-Punkt.
