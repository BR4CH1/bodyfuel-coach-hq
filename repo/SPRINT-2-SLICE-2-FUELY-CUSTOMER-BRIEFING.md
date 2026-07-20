# Sprint 2 · Slice 2 — Fuely Kunden-Tagesbriefing

## Ziel

Fuely wird auf dem Kunden-Dashboard zum sichtbaren Tagesbegleiter. Statt mehrere Statuskarten selbst zu durchsuchen, sieht der Nutzer direkt seine drei wichtigsten nächsten Schritte.

## Umsetzung

Neu angelegt:

- `src/features/customer-dashboard/components/CustomerFuelyBriefing.tsx`
- `src/features/customer-dashboard/lib/customer-briefing.logic.ts`
- `src/features/customer-dashboard/lib/__tests__/customer-briefing.logic.test.ts`
- `src/features/customer-dashboard/types.ts`

In `src/routes/dashboard.tsx` integriert.

## Funktionsumfang

- priorisiert überfällige und heute fällige Check-ins
- erkennt fehlende Körpermaße im abgegebenen Check-in
- fordert bei fehlenden oder veralteten Messungen zur Aktualisierung auf
- zeigt noch offene Tagespunkte
- bietet den direkten Einstieg ins Training
- berücksichtigt fehlende oder aktuell geprüfte Ernährungspläne
- zeigt Training, Messung und Tagespunkte als kompakten Tagesstatus
- verwendet ausschließlich bereits geladene Dashboard-Daten
- ersetzt den isolierten Check-in-Hinweis durch ein zusammenhängendes Fuely-Briefing

## Qualität

- TypeScript: bestanden
- ESLint für Route und neue Feature-Dateien: bestanden
- Server-Validator-Guard: bestanden
- Build-Memory-Guard: bestanden
- Browser-only-Import-Guard: bestanden
- Tests: 132/132 bestanden
- neue Tests: 5/5 bestanden
