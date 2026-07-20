# Sprint 1 – Slice 11: TypeScript-Stabilisierung

## Ziel

Der bisherige vollständige `tsc --noEmit`-Lauf benötigte selbst nach mehr als zehn Minuten noch kein Ergebnis. Dadurch gab es keinen verlässlichen TypeScript-Check für lokale Arbeit oder CI.

## Änderungen

- Neuer schneller Standard-Check:
  - `npm run typecheck`
  - verwendet die fest gepinnte native TypeScript-Vorschau (`tsgo`)
- Klassischer Compiler bleibt verfügbar:
  - `npm run typecheck:legacy`
- Alle aktuell vom schnellen Gesamtcheck gefundenen Router-Typfehler wurden behoben.
- `/auth`-Navigationen übergeben nun den von `validateSearch` erwarteten Search-State explizit.
- Ein dauerhafter Legacy-Einstieg `/bulls` wurde ergänzt und leitet auf die generische Organisationsroute `/$orgSlug` mit `orgSlug = "bulls"` weiter.
- Der veraltete Link `/bulls/onboarding` verwendet nun die kanonische Organisationsroute.
- `src/routeTree.gen.ts` wurde über den TanStack-Router-Generator aktualisiert.

## Ergebnis

- `npm run typecheck`: erfolgreich, etwa 18–19 Sekunden in der Prüfungsumgebung
- Vitest: 9 Testdateien, 101 Tests erfolgreich
- Der klassische `tsc`-Check bleibt als Vergleich verfügbar, ist für diesen großen Route Tree aktuell jedoch weiterhin praktisch nicht nutzbar.

## Offener Punkt

Der vollständige Produktionsbuild überschritt in der Prüfungsumgebung weiterhin das Fünf-Minuten-Limit. Der Build erzeugt weiterhin zahlreiche TanStack-Warnungen wegen der veralteten `createServerFn().inputValidator()`-API. Diese Migration ist der nächste technische Stabilisierungsschritt.
