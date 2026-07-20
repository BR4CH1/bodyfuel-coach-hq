# Sprint 1 – Slice 13: SSR-Build-Stabilisierung

## Ursache

Der Client- und SSR-Vite-Build liefen erfolgreich durch. Der nachgelagerte Nitro-Build brach jedoch beim Transformieren mit einem V8-Heap-Fehler bei ungefähr 2 GB ab:

`FATAL ERROR: Ineffective mark-compacts near heap limit – JavaScript heap out of memory`

Damit war das Problem kein TypeScript-Fehler und kein TanStack-Validator-Problem, sondern ein Speicherlimit des Node-Prozesses während des Cloudflare-Nitro-Bundlings.

## Änderung

- `npm run build` startet Vite jetzt mit 4096 MB Node-Heap.
- `npm run build:dev` nutzt dasselbe Limit.
- `npm run build:diagnose` aktiviert zusätzlich V8-GC-Ausgaben für spätere Analysen.
- `npm run check:build-memory` schützt die Konfiguration gegen versehentliches Zurücksetzen.
- `npm run verify` prüft nun auch diesen Guard.
- `npm run verify:build` führt Qualitätschecks und anschließend den Produktionsbuild aus.

## Befehle

```bash
npm run verify
npm run build
npm run verify:build
```

## Hinweis

Die Erhöhung des Heap-Limits behebt den reproduzierten Abbruch. Sie ersetzt keine spätere Bundle-Optimierung. Große Client-Chunks, besonders `NutritionTracker` und der gemeinsame `index`-Chunk, sollten in einem separaten Performance-Slice per Dynamic Import und gezieltem Code-Splitting verkleinert werden.
