# Sprint 2 – Slice 6: Fuely Coach Intelligence

## Ziel

Fuely verdichtet bestehende Coach-Daten in drei unmittelbar verständliche Fragen:

- Wer stagniert?
- Wer hat erhöhten Betreuungsbedarf?
- Wer benötigt heute Aufmerksamkeit?

## Umsetzung

- neue reine Entscheidungslogik `coach-intelligence.logic.ts`
- deduplizierte, priorisierte Signale
- neue Dashboard-Komponente mit Direktnavigation zum Kunden
- Integration in den Coach-Dashboard-Controller
- Unit-Test für Stagnation, Risiko und Aufmerksamkeit

## Abgrenzung

Dieser Slice nutzt vorhandene Daten. Verletzungs-, Schlaf- und Wearable-Signale folgen, sobald die jeweiligen Datenquellen vereinheitlicht sind.
