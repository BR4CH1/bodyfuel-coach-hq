# BodyFuel Training V2 — Slice 1

Stand: 23.07.2026

Dieses Overlay setzt den freigegebenen Training-V2-Entwurf in der bestehenden
BodyFuel-App um. Es ist keine neue Datenbankmigration erforderlich.

## Enthalten

- Coach Training Builder V2 mit hellem Workspace
- Wochen- und Tagesplanung, Kopieren und Auto-Fill
- Übungsbibliothek mit Suche und Muskelgruppenfiltern
- Drag-and-drop für Übungen innerhalb und zwischen Trainingstagen
- Zielwerte für Sätze, Wiederholungen, Gewicht, RIR und Pause
- Entwurf speichern und Plan sicher zuweisen
- Sicherer Wechsel des aktiven Plans trotz bestehender Unique Constraints
- Partnerpläne werden erst aktiviert, wenn beide Seiten vollständig angelegt sind
- Mobile Kundenansicht mit Fokus auf das heutige Training
- Fortschrittsanzeige, Satzprotokoll, letzte Leistung und Übungsverlauf
- Pausentimer mit Start, Pause und Reset
- Eigene Zusatzsätze, Übungsnotizen und Schmerz-/Check-in-Link
- Lokaler Kalendertag für Tracking und Trainingabschluss, inklusive Zeitzonenoffset

## Installation

ZIP in das Root-Verzeichnis des BodyFuel-Repositories hochladen und dort ausführen:

```bash
unzip -o bodyfuel-training-v2-slice1-20260723.zip
npm ci
npm run build
git status --short
```

Danach die Änderungen wie gewohnt committen und deployen.

## Smoke-Test

1. Als Coach einen Kunden öffnen und den Training Builder starten.
2. Übungen aus der Bibliothek hinzufügen, verschieben und eine Woche kopieren.
3. Erst als Entwurf speichern. Der bisher aktive Kundenplan muss aktiv bleiben.
4. Den neuen Plan zuweisen. Er muss danach der einzige aktive Trainingsplan sein.
5. Als Kunde `/training` öffnen und einen Satz speichern.
6. Prüfen, ob Fortschritt und letzter Satz aktualisiert werden und der Pausentimer startet.
7. Einheit abschließen und anschließend Verlauf sowie Trainingsanalyse öffnen.
8. Falls ein Partner hinterlegt ist, einen Partnerplan auf beiden Seiten prüfen.

## Prüfstatus

- Produktions-Build: erfolgreich
- Neue UI-Dateien: ESLint erfolgreich
- TypeScript: keine Fehler in den Training-V2-Dateien
- Tests: 141 von 144 erfolgreich

Im übernommenen Projektbestand existieren unabhängig von Training V2 bereits:

- TypeScript-Fehler im Coach-Dashboard, in `nutrition.functions.ts` und in `fuely.tsx`
- drei fehlschlagende Coach-Dashboard-Tests mit bestehenden Datums-/Prioritätsannahmen
- TanStack-Hinweise zu veralteten `.inputValidator()`-Aufrufen
- eine bestehende PWA-Warnung zu einem leeren Precache-Glob

Diese Altlasten blockieren den Produktions-Build nicht und wurden in diesem fokussierten
Training-Update nicht verändert.

## Geänderte Dateien

- `src/components/bodyfuel/TrainingPlanBuilderPage.tsx`
- `src/components/bodyfuel/TrainingTracker.tsx`
- `src/lib/training-plan-builder.functions.ts`
- `src/lib/training.functions.ts`
- `src/routes/training.tsx`
- `src/styles.css`

