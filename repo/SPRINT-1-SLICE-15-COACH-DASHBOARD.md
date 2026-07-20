# Sprint 1 – Slice 15: Coach Dashboard

## Ziel

Die 1.744 Zeilen große Route `src/routes/coach.index.tsx` in eine dünne Route, einen Dashboard-Controller, eine typisierte Datenabfrage, testbare Domain-Logik und klar abgegrenzte UI-Bereiche zerlegen.

## Ergebnis

- `src/routes/coach.index.tsx`: 1.744 → 13 Zeilen
- Neue Feature-Struktur unter `src/features/coach-dashboard/`
- Supabase-Abfragen aus der Route entfernt
- Dashboard-Kennzahlen und Coach Score als Pure Functions ausgelagert
- Veraltete, nicht mehr gerenderte lokale Aufgaben-Inbox inklusive ungenutzter Mutationslogik entfernt
- Lade- und Fehlerzustand über React Query vereinheitlicht

## Neue Struktur

```text
src/features/coach-dashboard/
├── components/
│   ├── CoachAttentionSection.tsx
│   ├── CoachCustomerOverviewSection.tsx
│   ├── CoachDashboardHeader.tsx
│   ├── CoachDashboardPage.tsx
│   ├── CoachDashboardPrimitives.tsx
│   ├── CoachPerformanceNotice.tsx
│   └── CoachRankingPanel.tsx
├── hooks/
│   └── useCoachDashboardController.ts
├── lib/
│   ├── __tests__/
│   │   └── coach-dashboard.logic.test.ts
│   ├── coach-dashboard.data.ts
│   └── coach-dashboard.logic.ts
└── types.ts
```

## Technische Verbesserungen

- Client-, Lead-, Score- und View-Model-Typen zentral definiert
- Keine expliziten `any`-Typen in den neuen Dateien
- Parallelisierte Dashboard-Abfragen mit kontrollierter Fehlerbehandlung
- Coach Score, Planwarnungen, Inaktivität und Aktivitätslisten deterministisch testbar
- React Query ersetzt den manuellen `useEffect`-/Loading-State
- Route enthält nur noch Layout und Page-Komponente

## Prüfungen

- `npm run typecheck`: bestanden
- gezielter ESLint-Check: bestanden
- `npm run verify`: bestanden
- Tests: 111/111 bestanden
- neue Dashboard-Tests: 5/5 bestanden
- Client-Produktionsbundle: erfolgreich in ca. 29 Sekunden
- Vollständiger SSR-/Nitro-Schritt: weiterhin nicht innerhalb von 180 Sekunden abgeschlossen

## Nächster Schritt

`src/lib/nutrition-plan-ai.functions.ts` in Validatoren, Prompt-/Schema-Logik, Datenzugriff und Plan-Generierung zerlegen.
