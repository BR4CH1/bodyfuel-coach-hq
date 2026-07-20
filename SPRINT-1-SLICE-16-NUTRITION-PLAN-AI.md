# Sprint 1 – Slice 16: Nutrition Plan AI

## Ziel

Die bisherige `src/lib/nutrition-plan-ai.functions.ts` war mit 1.486 Zeilen gleichzeitig:

- client-importierbarer TanStack-Server-Fn-Einstieg,
- Server-Orchestrator,
- AI-Gateway,
- Makro-/Schedule-Domainlogik,
- Fallback-Mahlzeitenlogik,
- Persistenzschicht,
- Shopping-List-/Wish-/Coach-Alert-Workflow.

Dieser Slice trennt diese Verantwortlichkeiten und schützt Server-Code vor dem Client-Bundle.

## Neue Struktur

```text
src/features/nutrition-plan-ai/
├── types.ts
├── lib/
│   ├── plan.logic.ts
│   └── __tests__/
│       └── plan.logic.test.ts
└── server/
    ├── ai-gateway.server.ts
    ├── generate-plan.server.ts
    └── plan-persistence.server.ts
```

Der öffentliche Einstieg bleibt kompatibel:

```text
src/lib/nutrition-plan-ai.functions.ts
```

Er enthält nur noch Autorisierung, Validator, dynamische Server-Imports und den Kompatibilitäts-Wrapper für Autopilot/Renewal-Jobs.

## Wichtige Änderungen

- `nutrition-plan-ai.functions.ts`: 1.486 → 58 Zeilen.
- AI-Provider-Fallback und JSON-Parsing sind vom Plan-Generator getrennt.
- Persistenz, Planarchivierung, Days/Meals, Shopping List, Wishes und Coach Alerts sind getrennt.
- Zielrichtung, Mifflin-Fallback, Carb-Cycling, Wochentage, Exclusions und Meal-Fallbacks sind testbare Domainlogik.
- Serverseitige Module liegen hinter dynamischen Imports; der TanStack-Client-Build blockiert keine `server/`-Imports mehr.
- Die neu angelegten und geänderten Dateien enthalten keine expliziten `any`-Typen.

## Prüfungen

- `npm run verify`: bestanden.
- TypeScript: 0 Fehler.
- Tests: 119/119 bestanden.
- Neue Nutrition-Plan-AI-Tests: 8/8 bestanden.
- Gezieltes ESLint: bestanden.
- Client-Produktionsbundle: erfolgreich in ca. 28 Sekunden.
- SSR-/Nitro-Build: startet anschließend korrekt, war nach 220 Sekunden weiterhin im Transform-Schritt und wurde durch das Prüfzeitlimit beendet. Das bekannte SSR-Performanceproblem ist damit weiterhin separat offen.

## Nächster Schnitt

`generate-plan.server.ts` enthält noch Datenbeschaffung, Prompt-Aufbau und Engine-Reparaturschleife. Der nächste Nutrition-AI-Slice sollte daraus drei weitere serverseitige Bausteine machen:

1. `generation-context.server.ts`
2. `prompt-builder.ts`
3. `meal-computation.server.ts`
