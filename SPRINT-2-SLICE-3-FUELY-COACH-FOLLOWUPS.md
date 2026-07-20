# Sprint 2 · Slice 3 — Fuely Coach Follow-ups

## Ziel

Fuely verwandelt priorisierte Coach-Signale in direkt nutzbare, persönliche Nachrichtenentwürfe.

## Umsetzung

- maximal drei priorisierte Follow-ups
- Vorlagen für Risiko-Kunden, fehlende Check-ins, Inaktivität, auslaufende Pläne und neue Leads
- Deduplizierung je Empfänger
- direkter Sprung zum Kunden oder Lead-Bereich
- Ein-Klick-Kopieren mit Feedback
- reine Logik auf bereits geladenen Dashboard-Daten

## Dateien

- `src/features/coach-dashboard/lib/coach-followups.logic.ts`
- `src/features/coach-dashboard/components/CoachFuelyFollowUps.tsx`
- `src/features/coach-dashboard/lib/__tests__/coach-followups.logic.test.ts`

## Versand-Upgrade

- Follow-ups können direkt aus dem Coach-Dashboard als In-App-Nachricht versendet werden.
- E-Mail-Versand nutzt die bestehende transaktionale BODYFUEL-E-Mail-Queue.
- Für bestehende Kunden stehen drei Aktionen bereit: Nachricht, E-Mail oder beide Kanäle gleichzeitig.
- Neue Leads können direkt per E-Mail kontaktiert werden.
- Empfängeradressen werden serverseitig aus Supabase Auth bzw. der Lead-Tabelle aufgelöst und nicht vom Browser übergeben.
