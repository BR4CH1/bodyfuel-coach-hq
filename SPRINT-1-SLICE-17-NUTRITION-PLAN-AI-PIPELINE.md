# Sprint 1 – Slice 17: Nutrition-Plan-AI Pipeline

## Ziel

Die verbliebene 756-Zeilen-Generatorfunktion wurde in klar getrennte Pipeline-Schritte zerlegt. Datenzugriff, Prompt-Erstellung, KI-Retry-/Makroberechnung und Persistenz sind jetzt unabhängig voneinander wartbar und testbar.

## Neue Struktur

```text
src/features/nutrition-plan-ai/
├── lib/
│   ├── prompt-builder.ts
│   └── __tests__/prompt-builder.test.ts
└── server/
    ├── generate-plan.server.ts
    ├── meal-computation.server.ts
    └── plan-data.server.ts
```

## Änderungen

- `generate-plan.server.ts`: 756 → 35 Zeilen; nur noch Pipeline-Orchestrierung.
- `plan-data.server.ts`: lädt Profil, Messungen, Ziele, Feedback, Wünsche und den Safe-Food-Pool parallel.
- `prompt-builder.ts`: erzeugt deterministisch Ziele, Zeitplan, Ausschlüsse, No-Cook-Regeln und den vollständigen KI-Prompt.
- `meal-computation.server.ts`: kapselt AI-Retries, Pflicht-Mahlzeiten, Nutrition-Engine, unresolved food IDs, 850-kcal-Splitting und Korrektur-Snacks.
- Gemeinsame Quell- und Pipeline-Typen wurden in `types.ts` ergänzt.
- Der Safe-Food-Pool wird nun gemeinsam mit den übrigen Eingangsdaten geladen statt später seriell.
- Das ungenutzte `hasUnresolved` wurde entfernt.

## Prüfungen

- `npm run typecheck`: bestanden, 0 Fehler.
- ESLint für `src/features/nutrition-plan-ai`: bestanden.
- Neue Prompt-Builder-Tests: 4/4 bestanden.
- Gesamter Verify-Lauf: 123/123 Tests bestanden.
- Client-Produktionsbundle: erfolgreich in ca. 27 Sekunden.
- SSR-/Nitro-Build: nach 240 Sekunden weiterhin im Transform-Schritt; separat offen.

## Nächster sinnvoller Schritt

Der verbleibende große Block ist `plan.logic.ts` mit rund 744 Zeilen. Er sollte nicht blind weiter zerlegt werden. Zuerst sollte der SSR-Transform mit Vite/Nitro-Profiling auf den konkreten Modulgraphen eingegrenzt werden, damit der vollständige Produktionsbuild verlässlich abgeschlossen werden kann.
