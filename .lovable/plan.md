## 1) Bestätigter Ist-Stand (verifiziert auf HEAD)

**Was tatsächlich verdrahtet ist:**
- `TrainingPlanBuilderPage.tsx` (Coach) ruft echte Server-Funktionen auf: `getCustomerTrainingContext`, `listExerciseLibrary`, `saveBuilderTrainingPlan`, `saveBuilderPartnerTrainingPlan`, `loadTrainingPlanForBuilder`, `saveAsTrainingTemplate`. Entwurf/Zuweisen läuft über das `publish`-Flag; danach Navigation zurück zum Org-Athleten-Tab oder zur Plan-Vorschau.
- `TrainingTracker.tsx` (Kunde/Coach) lädt Plan, Tage, Übungen und historische `training_set_logs` direkt via Supabase, loggt Sätze über `logSet` (offline-fähig über Queue), startet Pausentimer, schließt Einheiten über `completeTrainingSession` ab und zeigt Progressions-Entscheidungen als Toasts.
- Die Engine ist **kein toter Code**: `completeTrainingSession` durchläuft pro Übung `progressExerciseAfterSession` → `applyReadinessGateWithMeta` → `applySmartLock`, schreibt `training_progression_events` und aktualisiert `athlete_exercise_state`. Readiness-Cooldown (7 Tage nach hartem Gate) ist aktiv.
- Gamification (PRs, Punkte, Streaks) läuft unabhängig über den DB-Trigger `process_training_set` auf `training_set_logs` — separate Domäne, kein Progressions-Bestandteil.

**Blocker-Status:** Typecheck (`tsgo --noEmit`) ist sauber (0 Fehler). Tests laufen grün (28 Dateien, 196 Tests). **Es gibt aktuell keinen Typecheck-, Test- oder Routing-Fehler, der den Go-live blockiert.** Der eigentliche Go-live-Blocker ist ein anderer: der komplette Training-V2-Stack (Engine, Server-Funktionen, Tracker, Builder) hat **null Testabdeckung**.

## 2) Konkrete Lücken mit betroffenen Dateien

1. **Keine Tests auf der Progressions-Engine** — `src/lib/training-engine/progression.ts`, `readiness-gate.ts`, `lock.ts`, `athlete-exercise-state.ts`. Genau die Logik, die Gewichte des Kunden verändert, ist ungetestet. Höchstes Risiko für stille Fehlentscheidungen.
2. **Doppelstruktur auf den Kundenseiten** — `PlanContentView` (Legacy-Plananzeige) und `TrainingTracker` (V2) rendern denselben Plan gleichzeitig: in `src/routes/training.tsx:124` (eingeklappt) und in `src/routes/bulls.training.tsx:68` (prominent, direkt über dem Tracker). Synchronisiert nur lose über localStorage-Key `bf:training:active-day-name:*` plus CustomEvent. Beide Komponenten rufen zudem unabhängig `parseTrainingPlan` auf.
3. **Toter Export** — `progressAfterExercise` in `src/lib/training.functions.ts:232` hat keinerlei Aufrufstelle; die Logik ist inline in `completeTrainingSession` dupliziert. Zwei Kopien derselben Regel, die auseinanderlaufen können.
4. **Zwei parallele „Engines" für Startwerte** — der manuelle Builder nutzt `training-autofill.ts` + `weightFromBaseline` (Regex auf `strength_checks`), der KI-Generator nutzt `start-weight-resolver.ts` / `week-structure.ts` / `movement-framework.ts`. Manuell und KI erzeugte Pläne starten daher unterschiedlich.
5. **Ungeklärt:** ob `smart_lock` im Builder überhaupt eine Bedien-UI hat (Datenfeld wird geschrieben, Steuerelement nicht bestätigt).

## 3) Nächster Slice (exakt abgegrenzt, ein Durchlauf)

**Slice: „Training V2 — Engine absichern & Kundenansicht entdoppeln"**

**A. Engine-Testabdeckung (Kern des Slices)**
Neue Testdateien unter `src/lib/training-engine/__tests__/`:
- `progression.test.ts` — Laststeigerung bei erfüllten Zielen, Reduktion bei Zielverfehlung, Reps-vor-Gewicht-Reihenfolge, Verhalten bei fehlenden Vorwerten (erste Einheit).
- `readiness-gate.test.ts` — hartes Gate reduziert, weiches Gate friert ein, 7-Tage-Cooldown unterdrückt Steigerung, ohne Check-in bleibt die Entscheidung unverändert.
- `lock.test.ts` — `none`, `locked`, `weight_only`, `reps_only`, `volume_only` beschneiden die Entscheidung jeweils korrekt.
- `athlete-exercise-state.test.ts` — `normalizeExerciseKey` (Groß/Klein, Umlaute, Zusätze), `stateFromDecision` liefert konsistente Trend-/Statuswerte.

**B. Duplikat-Regel: eine Wahrheitsquelle**
`progressAfterExercise` wird aus `src/lib/training.functions.ts` entfernt; die Entscheidungslogik pro Übung wandert in eine gemeinsame Hilfsfunktion, die `completeTrainingSession` aufruft. Kein Verhaltenswechsel, nur Entdopplung — abgesichert durch die Tests aus A.

**C. Kundenansicht entdoppeln (Rückfalloption bleibt erhalten)**
- `src/routes/bulls.training.tsx`: `PlanContentView` wird — wie bereits in `/training` — in ein eingeklapptes „Vollständigen Trainingsplan anzeigen"-Element gelegt, unter dem Tracker. Der Tracker wird damit auf beiden Seiten die primäre Oberfläche, die Legacy-Ansicht bleibt als Rückfall vollständig erreichbar.
- Der localStorage/Event-Bridge bleibt unangetastet.

**Akzeptanzkriterien**
- `bunx vitest run` grün, mindestens 20 neue Tests, alle vier Engine-Module abgedeckt.
- `tsgo --noEmit` weiterhin 0 Fehler.
- Kein Aufruf von `progressAfterExercise` mehr im Repo; Einheit abschließen liefert unverändert dieselben Entscheidungs-Toasts.
- `/bulls/training` und `/training` zeigen beide zuerst den Tracker, die vollständige Planansicht ist eingeklappt erreichbar.
- Coach-Flow unverändert: Plan bauen → Entwurf speichern (aktiver Plan bleibt aktiv) → zuweisen (neuer Plan ist einziger aktiver) — manuell nachgeprüft.

## 4) Bewusst später

- Vereinheitlichung von manuellem Builder und KI-Generator auf `start-weight-resolver` / `week-structure` (großer Eingriff in beide Erzeugungspfade).
- `smart_lock`-Bedien-UI im Builder (erst nach Klärung, ob sie fehlt).
- Vollständige Ablösung von `PlanContentView` im Trainingsbereich — bleibt Rückfalloption bis V2 stabil ist.
- Integrationstests für `TrainingTracker`/`TrainingPlanBuilderPage` (UI-Ebene) und für die Server-Funktionen.
- Der Org-Bereich `/$orgSlug/training` (Athletiktraining) ist eine eigene Domäne und nicht Teil dieses Slices.
