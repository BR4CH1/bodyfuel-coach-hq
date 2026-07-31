# BodyFuel Dashboard, Training & Fuely – Handoff

Stand: 30.07.2026

## Enthalten

### Training bleibt nach Displaysperre oder App-Wechsel erhalten

- Aktiver Plan, Tage, Übungen und die letzten Satz-Logs werden lokal gespiegelt.
- Noch nicht abgehakte Gewichts-/Wiederholungseingaben, zusätzliche Sätze, Notizen,
  offener Trainingstag und Pausentimer bleiben erhalten.
- Beim Öffnen erscheint sofort der letzte sichere Stand; im Hintergrund werden
  aktuelle Serverdaten geladen.
- Ein Lade-Timeout verhindert ein endloses „Lade Übungen …“.
- Offline gespeicherte Sätze bleiben in der vorhandenen Sync-Queue.
- Ein neuer Service Worker übernimmt nicht mehr ungefragt mitten im Training.

### Coach-Dashboard

- Die persönlichen Kennzahlen enthalten nur aktive BodyFuel-Coaching-Pakete,
  nicht alle jemals registrierten Accounts.
- Performance Tests und Player Cards sind aus „Mein BodyFuel“ entfernt und
  bleiben in den Vereinsbereichen.
- Fuely Briefing öffnet direkt die passende, gefilterte Workload-Kategorie.
- Fuely Workload ersetzt Coach Intelligence, Coach Radar und Aufgaben-Inbox als
  primäre Arbeitsansicht.
- Follow-ups stehen direkt unter der Workload; weitere Auswertungen sind
  einklappbar.

### Follow-ups und E-Mail

- Follow-up-Status wird serverseitig in `coach_task_state` gespeichert.
- Erledigte Follow-ups bleiben 14 Tage ausgeblendet; Snooze und Ausblenden
  funktionieren geräteübergreifend.
- E-Mails werden wirklich über den vorhandenen Lovable-Maildienst versendet.
- Absender: `Manuel | BodyFuel <manuel@bodyfuel-coaching.com>`
- Reply-To: `manuel@bodyfuel-coaching.com`
- Idempotente Message-IDs verhindern Doppelversand bei einem Netzwerk-Retry.
- Eine Karte gilt erst nach bestätigtem Versand als erledigt.

### Kundendashboard

- Tagesaktionen, Fuely Briefing, Momentum, Makros und Checkliste bleiben oben.
- Fortschritt, Analysen und Erfolge sind in einem eigenen Bereich gebündelt.
- Plan-Automatik und Paketdetails sind separat einklappbar.
- Ein Ablaufhinweis öffnet den Paketbereich automatisch.

### Fuely

- Positionierung: BodyFuel bleibt die Marke; Fuely ist der smarte Begleiter.
- Semantische, kurze Animationen für Winken, Denken, Erfolg und Feiern mit
  `prefers-reduced-motion`.
- Echte Schnellaktionen für Wasser, Regeneration, Coach-Nachrichten,
  Kalorienziel und Check-in.
- Veraltete Datenbankfelder in Profil, Messungen, Check-ins, Punkten,
  Challenges und Coach-Nachrichten wurden korrigiert.
- Fuely versteht sowohl geplante Team-Sessions als auch den persönlichen
  Satz-für-Satz-Tracker.
- Persönliche Trainingspläne werden nicht blind abgehakt: Fuely öffnet den
  Tracker, damit Smart-Progression vollständig ausgewertet wird.
- In-App-Navigation ist auf bekannte BodyFuel-Routen begrenzt.
- Große Änderungen wie ein Kalorienziel benötigen weiterhin eine konkrete
  Bestätigung und bleiben rückgängig machbar.

## Deployment-Konfiguration

Serverseitig müssen mindestens diese Secrets gesetzt sein:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

Optional kann `LOVABLE_SEND_URL` gesetzt werden. Die Absenderadresse
`manuel@bodyfuel-coaching.com` beziehungsweise die zugehörige Domain muss beim
Mailanbieter verifiziert sein.

Lokale Werte gehören in `.env` beziehungsweise `.dev.vars`; beide Dateien sind
git-ignoriert. `.env.example` enthält nur die benötigten Variablennamen.

## Verifikation

- TypeScript: fehlerfrei
- Tests: 252/252 bestanden
- Browser-only-Import-Guard: bestanden
- Produktions-Build: bestanden

Der bestehende Sammelbefehl `npm run verify` stoppt aktuell bereits am
repositoryweiten Legacy-Guard, weil ältere, nicht zu diesem Update gehörende
Server-Funktionen noch `.inputValidator()` verwenden. Die in diesem Update
angefassten neuen Server-Funktionen verwenden bereits `.validator()`.

## Kurzer Live-Test nach Deployment

1. Training öffnen, Gewicht/Wiederholungen eintippen, Display sperren und nach
   einer Minute zurückkehren.
2. App ganz verlassen und Training erneut öffnen; Plan und Entwürfe müssen
   sofort wieder sichtbar sein.
3. Einen Test-Follow-up per Mail senden und Absender, Reply-To sowie den
   ausgeblendeten Erledigt-Status prüfen.
4. Fuely die heutigen Ziele und Coach-Nachrichten abfragen lassen.
5. Fuely „250 ml Wasser eintragen“ ausführen und anschließend rückgängig machen.
