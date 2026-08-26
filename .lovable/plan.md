# Diagnose: TrainingTracker verliert Eingaben nach iPhone-Sperre (PWA)

Nur Analyse — keine Codeänderungen vorgenommen. Ablauf: Werte eintragen / Satz speichern → Handy sperren bzw. App in den Hintergrund → App wieder öffnen → Teil des Stands fehlt.

## Beobachteter Referenzfall (verifiziert in der DB)

- Remote-Draft `b5f6d31b…:2026-08-25`: letzter Server-Schreibvorgang **19:26:54 UTC**, `client_revision 481`, `server_revision 155`.
- `training_set_logs` desselben Nutzers wurden danach noch bis **19:29:02 UTC** geschrieben (Butterfly Maschine, Sätze 1–3).
- Heißt: der Satz-Insert-Pfad lief weiter, der **Draft-Sync war ab 19:26:54 dauerhaft tot** — kein Netzausfall, sondern ein Zustandsproblem im Sync.

## Root-Cause-Hypothesen, nach Wahrscheinlichkeit

### 1. Konflikt-Pfad verwirft Änderungen endgültig und heilt nie (erklärt den Referenzfall vollständig)

`use-persistent-workout-session.ts:105-121`: bei `applied === false` und nicht exakt gleicher Revision wird `setSaveStatus("conflict")` gesetzt und der Snapshot per `continue` **verworfen** — ohne `remoteRevision` auf den Serverwert zu rebasen und ohne Wiederholung.

Der Server (`save_workout_session_draft`) wendet nur an, wenn `p_expected_server_revision = server_revision`. Sobald der Client eine Antwort verliert (typisch beim Bildschirmsperren: der Request in `saveBeforeBackground`, Zeile 336, wird per `void pushRemote(...)` unbeaufsichtigt abgeschickt, iOS friert den Prozess ein und die Antwort kommt nie an), bleibt `remoteRevision` beim Client veraltet. Jeder weitere Save schickt dieselbe veraltete `expected`-Revision → `applied=false` → conflict → verworfen. Genau dieses Bild: Server bleibt bei 155/481 stehen, der lokale Zähler läuft weiter.

Zusätzlich fehlt jede Heilung: `restore()` (Zeile 229-300) läuft nur beim Mount; `handleVisibility` (Zeile 339-341) reagiert **nur auf `hidden`**, nicht auf `visible`. Es gibt also keinen Re-Load/Re-Sync beim Zurückkommen aus dem Hintergrund. Sichtbar ist das nur als kleiner amberfarbener Chip „Synchronisierung nötig“ (`WorkoutSaveIndicator`), was im Training niemand als Datenverlust liest.

### 2. Remote-Draft ist beim Remount älter als der lokale Stand — aber gewinnt, wenn iOS den lokalen Speicher geräumt hat

Nach dem Aufwecken verwirft iOS PWA-Seiten regelmäßig; die Komponente mountet neu (`TrainingTracker` hängt in `src/routes/training.tsx:82/92` an einem Key mit `effectiveId`; solange die Session noch nicht hydriert ist, ist `effectiveId` leer → Unmount/Remount).

`restore()` wählt dann per `chooseNewestDraft` zwischen localStorage-Notfall-Snapshot, IndexedDB und Remote. Ist der lokale Anteil weg oder unlesbar (Safari-Eviction, Speicherdruck, Quota-Fehler in `writeLocalDraft` → still verschluckt, `workout-session-draft.store.ts:164-168`), gewinnt der **auf 19:26:54 eingefrorene Remote-Draft** — also exakt das Symptom „Stand teilweise weg“ (alles nach dem letzten erfolgreichen Server-Save fehlt). Ohne Hypothese 1 wäre der Remote-Stand aktuell und der Verlust unsichtbar; die beiden Fehler multiplizieren sich.

### 3. Debounce + eingefrorener Prozess: das letzte Fenster von 800 ms ist ungeschützt

`updateWorkout` (Zeile 172-197) schreibt localStorage synchron, der Server-Save ist um `autosaveMs = 800` verzögert (`queueRemoteSave`, Zeile 161-170). Beim Sperren feuert `visibilitychange`/`pagehide` → `saveBeforeBackground`, das aber
- den anstehenden Debounce-Timer nicht abbricht (ein späterer, älterer Push kann danach noch laufen),
- den Request ohne `keepalive`/`sendBeacon` und ohne `await` abschickt.
iOS beendet den Netzwerk-Request beim Freeze zuverlässig. Ergebnis: entweder gar kein Server-Save oder ein „halb angekommener“ Save → siehe Hypothese 1.

### 4. Revisionszähler wird durch Scroll-Events erhöht, ohne dass der State mitgeführt wird

`saveCurrentView` (Zeile 308-323) erhöht `localRevision` **nur auf `envelopeRef`** und schreibt lokal, ohne `setEnvelope` und ohne Server-Save. Damit divergieren React-State und Ref, und der lokale Revisionszähler springt gegenüber dem Server-Stand (481 vs. laufend höher) allein durch Scrollen im Training. Das verschärft jeden Vergleich in `chooseNewestDraft` und macht „gleiche Revision = idempotenter Retry“ (Zeile 112-114) praktisch wertlos.

### 5. Ein Gerät, zwei Tabs/Kontexte teilen dieselbe `deviceId`

`getOrCreateWorkoutDeviceId` speichert die ID in localStorage, also identisch für PWA-Tab und Safari-Tab derselben Origin. Der Server verlangt bei gleicher `device_id` strikt `p_client_revision > client_revision`. Zwei parallel offene Tracker (z. B. `/training` und `/bulls/training`) zählen unabhängig hoch → der Tab mit dem niedrigeren Zähler bekommt dauerhaft `applied=false` → Hypothese 1 tritt ohne jeden Netzfehler ein.

### 6. Sichtbarer Satzstatus hängt am 120-ms-Cache, nicht an der DB

Der „ist Satz X gespeichert“-Status kommt aus `logs` im TrainingTracker: beim Mount zuerst aus dem localStorage-Snapshot (Debounce 120 ms, `TrainingTracker.tsx:429-445`), erst danach bestätigt `reload()` gegen die DB — mit 12-s-Timeout, dessen Fehlschlag nur ein Banner erzeugt (`withTimeout`, Zeile 101-118). Wird direkt nach dem Speichern gesperrt, fehlt der letzte Satz im Snapshot; bei zäher Verbindung nach dem Aufwecken bleibt der veraltete Cache stehen → „meine Eingaben sind weg“, obwohl die Zeile in der DB liegt. Das ist der Auslöser für die dokumentierten Mehrfach-Inserts (5× Satz 1 Brustpresse am 25.08.), da `logSet` ein reiner INSERT ohne Unique-Constraint ist.

### 7. Unwahrscheinlich, aber ausgeschlossen zu prüfen

- **RLS/Rechte:** Policies auf `workout_session_drafts` und `training_set_logs` sind korrekt eigentümerbasiert; alle Schreibvorgänge des 25.08. gingen durch. Nicht die Ursache.
- **Datumswechsel im `draftKey`:** `draftKey = clientId:localDateKey()`; ein Training über Mitternacht erzeugt einen neuen Key und damit scheinbar leeren Stand. Im Referenzfall (21:29 Ortszeit) nicht relevant, als Nebenrisiko aber real.

## Minimal nötige Fixes (Vorschlag, noch nicht umgesetzt)

1. `applied === false` nicht mehr verwerfen: `remoteRevision` aus der Server-Antwort übernehmen, lokalen State darauf rebasen und **einmal erneut senden**; erst danach echten Konflikt melden.
2. Wieder-Sichtbarkeit heilen: bei `visibilitychange → visible` und `online` Draft neu laden, mit Server-Revision rebasen und die Warteschlange erneut abarbeiten.
3. Hintergrund-Save robust machen: anstehenden Debounce-Timer abbrechen, Save mit `keepalive`-Semantik bzw. sofort (ohne Debounce) beim ersten `hidden` senden.
4. Satzstatus verifizieren: nach `visible` gezielt die heutigen `training_set_logs` der offenen Übungen nachladen (kleiner Query statt komplettem `reload()`), damit gespeicherte Sätze nie als offen erscheinen.
5. Doppelinserts unmöglich machen: Unique-Index `(client_id, exercise_id, performed_at::date, set_number)` + `upsert` in `logSet`.
6. Aufräumen: `saveCurrentView` soll den Revisionszähler nicht erhöhen (Scrollposition getrennt oder ohne Revisionsbump speichern); `deviceId` pro Tab/Instanz ergänzen (z. B. `deviceId + Instanz-UUID`).

Priorität für den gemeldeten Ablauf: 1, 2, 3 (Datenverlust), dann 4 und 5 (falscher sichtbarer Stand, Duplikate), dann 6.
