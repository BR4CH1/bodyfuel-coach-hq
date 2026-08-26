# Diagnose: Trainingstracker Stefan Huven, 25.08.2026

Nur Analyse, keine Änderungen vorgenommen.

## Befund in den Daten

Sätze wurden sehr wohl gespeichert — 17 Logs am 25.08. (19:19–19:29 UTC), u. a.:

```text
19:22:41  Brustpresse Maschine  Satz 1  55 kg × 8
19:23:12  Brustpresse Maschine  Satz 1  55 kg × 8   <- Duplikat
19:23:28  Brustpresse Maschine  Satz 1  55 kg × 8   <- Duplikat
19:23:42  Brustpresse Maschine  Satz 1  55 kg × 8   <- Duplikat
19:24:45  Brustpresse Maschine  Satz 1  55 kg × 8   <- Duplikat
19:24:46  Brustpresse Maschine  Satz 2  60 kg × 8
19:24:50  Brustpresse Maschine  Satz 3  60 kg × 8
19:19–19:28  Warm-up Rudergerät  Satz 1  6x hintereinander
```

Der Draft `b5f6d31b…:2026-08-25` existiert, wurde aber zuletzt **19:26:54** geschrieben (server_revision 155, client_revision 481) — obwohl der Nutzer bis 19:29:02 weiter geloggt hat. Der Draft hat danach keine Server-Updates mehr erhalten.

Zusätzlich am 26.08.: zwei Logs derselben Übung „Warm-up: Rudergerät locker“ innerhalb von 6 Sekunden, aber auf **zwei verschiedenen Übungs-IDs** (Push-Tag 07.08. und Pull-Tag 08.08.) — der geöffnete Trainingstag ist zwischen den Eingaben gewechselt.

## Ursachen

1. **Trainingsplan ist abgelaufen, Tracker zeigt einen Alt-Tag.**
   Aktiver Plan `01e5fed0…` startet 17.07., 4 Wochen, letzter Tag 13.08. `TrainingTracker.reload()` (src/components/bodyfuel/TrainingTracker.tsx:293-330) klemmt die Woche auf `weeks_count` und zeigt daher am 25.08. Woche 4 mit `day_date = 2026-08-07`. Es gibt keinen Tag für „heute“; gewählt wird der erste Trainingstag der Woche. Gespeicherte Sätze landen also an Übungen eines Datums, das nicht dem heutigen entspricht — im Verlauf/„Letzte Einheit“ sieht das für den Nutzer nach Chaos bzw. Verlust aus.

2. **Tag springt während der Eingabe (führt zu doppelten Logs auf anderer Übungs-ID).**
   Der Namens-Sync-Effekt (TrainingTracker.tsx:474-504) mappt einen Tagesnamen aus `PlanContentView` per `days.find(...)` auf den **ersten** passenden Tag. Der Plan verwendet dieselben Namen mehrfach pro Woche („Push …“, „Pull …“, „Beine“), dazu kommt der `storage`-Event-Listener. Dadurch kann `openDayId` auf einen anderen Tag mit gleichem Namen wechseln; die angezeigten Übungs-IDs wechseln mit, bereits geloggte Sätze verschwinden aus der Ansicht.

3. **Anzeige „schon geloggt?“ hängt an flüchtigem State + Cache, nicht an der DB.**
   `nextIncompleteSet` (TrainingTracker.tsx:1371-1375) wird aus `logs`/`todaysLogs` berechnet. `logs` kommt beim Mount zuerst aus dem localStorage-Snapshot (Debounce 120 ms, TrainingTracker.tsx:429-445) und wird erst danach per `reload()` bestätigt. Wenn das Handy in die Tastensperre fällt / die PWA neu mountet, bevor der Snapshot geschrieben wurde, oder wenn `reload()` in den 12-s-Timeout läuft (`withTimeout`, TrainingTracker.tsx:101-118, dann nur `loadError`-Banner), zeigt die Karte Satz 1 wieder als offen. Der Nutzer tippt erneut auf Speichern.

4. **`logSet` ist ein reiner INSERT ohne Idempotenz — jedes erneute Tippen erzeugt eine neue Zeile.**
   src/lib/training.functions.ts:186-211 fügt ein; auf `training_set_logs` existiert nur der Primärschlüssel, kein Unique über (client_id, exercise_id, Datum, set_number). Daraus die 5x Satz 1 / 6x Warm-up-Satz-1.

5. **Draft-Sync stirbt still bei Revisions-Konflikt.**
   `save_workout_session_draft` liefert `applied=false`, wenn `p_expected_server_revision` nicht der gespeicherten `server_revision` entspricht (z. B. zweites Gerät/Tab, verlorene Antwort). Im Client (src/lib/training/use-persistent-workout-session.ts:109-121) wird die Momentaufnahme dann per `continue` **verworfen**, `remoteRevision` bleibt veraltet — alle weiteren Saves scheitern ebenfalls. Genau dieses Bild zeigt der 25.08.-Draft: Stopp um 19:26:54, danach nichts mehr. Sichtbar nur als kleiner Statuschip „Synchronisierung nötig“, ohne Wiederholung.

6. **RLS ist nicht die Ursache.** Policies auf `training_set_logs` und `workout_session_drafts` sind korrekt eigentümerbasiert; alle Schreibvorgänge sind durchgegangen.

## Minimal nötige Fixes (Vorschlag, noch nicht umgesetzt)

1. Doppelklick-/Retry-Schutz beim Loggen: Unique-Index `(client_id, exercise_id, (performed_at::date), set_number)` + `upsert` statt `insert` in `logSet`, plus Rückgabe der bestehenden Zeile.
2. Satzstatus aus der DB statt aus Cache verifizieren: nach jedem Speichern und bei `visibilitychange` gezielt die heutigen `training_set_logs` der offenen Übungen neu laden (kleiner Query, nicht der komplette `reload()`), und Sätze mit vorhandenem Log hart als „gespeichert“ rendern.
3. Tag-Sprung stoppen: `openDayId` nur noch per Tag-ID synchronisieren (nicht per Name), oder Namensmatch auf den Tag mit passendem `day_date` einschränken; `storage`-Listener nur akzeptieren, wenn kein Satz-Speichern läuft.
4. Draft-Sync konfliktresistent machen: bei `applied=false` die Server-`remoteRevision` übernehmen, lokalen State rebasen und **einmal erneut senden**, statt die Momentaufnahme zu verwerfen.
5. Abgelaufenen Plan sichtbar behandeln: wenn `heute > letzter Plan-Tag`, klaren Hinweis („Plan endete am 13.08.“) und Tagesauswahl an das heutige Datum binden, damit Logs nicht an Alt-Tagen hängen.

Priorität für den berichteten Fall: 1, 2 und 4 (verhindern Duplikate und den stillen Draft-Stopp), danach 3 und 5.
