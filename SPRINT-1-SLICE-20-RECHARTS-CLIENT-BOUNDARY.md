# Sprint 1 – Slice 20: Recharts Client Boundary

## Ziel

Die Diagrammbibliothek `recharts` darf nicht mehr statisch über Routen und isomorphe Komponenten in den SSR-Build gezogen werden. Diagramme werden erst nach der Hydration im Browser geladen.

## Umsetzung

Neu:

- `src/components/charts/ClientRecharts.tsx`
  - lädt `recharts` über `createClientOnlyFn()`
  - cached das geladene Modul für alle Diagramme
  - rendert während SSR und Ladephase einen stabilen Fallback
  - behandelt Importfehler ohne SSR-Absturz

Auf die Client-Grenze umgestellt:

- `ExerciseAnalytics`
- `WeightProgressChart`
- `PlayerCardBack`
- Bulls-Gewichtsverlauf
- altes Coach-Kundendetail
- generische `components/ui/chart.tsx`-Abstraktion

Der Browser-Import-Guard prüft nun auch `recharts`. Ein neuer statischer Import außerhalb einer expliziten Client-Datei lässt `npm run verify` fehlschlagen.

## Zusätzliche Bereinigung

Die bislang untypisierten Testdaten in `PlayerCardBack` wurden durch `VerifiedPlayerTest` ersetzt. Die veränderten Dateien enthalten keine neuen expliziten `any`-Typen.

## Prüfung

- Browser-only-Import-Guard: bestanden
- TypeScript: bestanden, 0 Fehler
- gezielter ESLint-Check: bestanden
- Vitest: 123/123 Tests bestanden
- Client-Produktionsbundle: erfolgreich in 17,68 Sekunden
- `recharts` liegt als eigener, verzögert geladener Client-Chunk vor (ca. 514 kB; gzip ca. 134 kB)

Der vollständige Build erreichte danach erneut die SSR-Phase, transformierte 893 Module und ging in `rendering chunks...` über. Der Lauf wurde vor einem bestätigten Nitro-Abschluss beendet. Das übergeordnete Nitro-/Cloudflare-Bundlingproblem ist daher noch nicht als gelöst markiert.
