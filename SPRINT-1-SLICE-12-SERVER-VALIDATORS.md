# Sprint 1 – Slice 12: TanStack Server-Validator-Migration

## Ziel

Alle veralteten `createServerFn().inputValidator()`-Aufrufe auf die aktuelle TanStack-Start-API `createServerFn().validator()` migrieren und eine Regression verhindern.

## Änderungen

- 387 Aufrufe in 98 TypeScript-Dateien migriert.
- Keine verbleibenden `.inputValidator()`-Aufrufe unter `src/`.
- Neuer Guard: `npm run check:server-validators`.
- Neuer Test-Befehl: `npm test`.
- Neuer Gesamtcheck: `npm run verify`.

## Validierung

- `npm run check:server-validators`: bestanden.
- `npm run typecheck`: bestanden, 0 Fehler.
- `npm test`: 101/101 Tests bestanden.
- Client-Produktionsbundle: erfolgreich in ca. 19 Sekunden.
- Keine `inputValidator()`-Deprecation-Warnungen mehr im Build-Log.
- Der vollständige SSR-Produktionsbuild bleibt nach dem Client-Bundle während `building ssr environment ... transforming...` hängen. Das ist ein separates Build-Performance-/SSR-Problem und nicht Teil der Validator-Migration.

## Offene technische Punkte

- SSR-Build-Hänger isolieren.
- PWA-Ausgabe prüft aktuell `dist/`, während der Client-Build in `.output/public/` landet.
- Große Client-Chunks weiter reduzieren (`NutritionTracker`, Hauptbundle, Chart-Bundle).
