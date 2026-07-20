# Sprint 1 – Slice 18: SSR-Build-Profiling

## Ausgangslage

Der Client-Build lief reproduzierbar durch. Der SSR-Build blieb anschließend über mehrere Minuten in der Ausgabe `transforming...` stehen.

## Gemessener Befund

Ein instrumentierter Lauf ergab:

- Client: 3.577 transformierte Module, Abschluss nach rund 28 Sekunden.
- SSR: 893 transformierte Module.
- Die SSR-Transformationen und `buildEnd` wurden erreicht.
- Danach blieb der Prozess CPU-lastig in der Output-/Renderphase hängen.
- Zum Zeitpunkt des Stillstands waren keine Modultransformationen mehr aktiv.

Damit liegt der Engpass nicht in einer einzelnen Datenbankfunktion und nicht in TypeScript, sondern nach Aufbau des SSR-Modulgraphen in der Rollup-Ausgabephase.

## Neue Diagnosewerkzeuge

```bash
npm run build:profile
npm run build:profile:report
```

Der Profilbuild schreibt `.build-profile.jsonl` und protokolliert:

- Client- und SSR-Phasen
- transformierte Module je Environment
- langsame Transformationen
- aktive und langsame Chunk-Renderings
- `generateBundle`- und `writeBundle`-Phasen
- RSS- und Heap-Speicher

### Isolationsläufe

```bash
npm run build:profile:no-mcp
npm run build:profile:no-pwa
npm run build:profile:inline-ssr
```

Damit lassen sich drei Kandidaten ohne dauerhafte Produktionsänderung getrennt testen:

1. MCP-Build-Plugin
2. PWA-Build-Plugin
3. SSR-Code-Splitting / Rollup-Chunkgraph

Alle Schalter sind ausschließlich über Umgebungsvariablen aktiv. Der normale `npm run build` bleibt unverändert.

## Nächste Entscheidung

Die Profile der drei Isolationsläufe werden verglichen. Erst danach wird eine Produktionsoption dauerhaft geändert. So vermeiden wir einen scheinbar schnelleren Build, der Deployment, PWA oder MCP unbemerkt beschädigt.
