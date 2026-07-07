# Bulls Performance Check – Umbau-Plan

Der bisherige generische Strength Check bleibt für normale BodyFuel-Nutzer unverändert bestehen. Im Bulls Hub wird er durch einen eigenen, modularen **Bulls Performance Check** mit 4 Modulen (Speed, Agility, Power, Strength) inkl. Video-Verifizierung durch Coaches ersetzt.

Ich habe die bestehende Architektur noch nicht gelesen – der Umfang ist erheblich. Vor Umsetzung möchte ich zuerst ein paar Punkte klären, damit wir das nicht in zwei Etappen bauen müssen.

## Umfang – V1 (dieser Auftrag)

### 1. Sport Performance Profile System (neu, generisch)
- Neue Registry unter `src/lib/performance-profiles/` (client-safe, rein deklarativ):
  - `types.ts` – `PerformanceProfile`, `PerformanceModule`, `PerformanceTest`, `PositionGroup`, `Benchmark`, `TestInputSchema`, `VideoRequirement`
  - `football_bulls.ts` – vollständige Definition (4 Module, 8 Tests, 4 Position Groups, Modulgewichte, Testanleitungen, Video-Anforderungen, Eingabefelder)
  - `index.ts` – Registry Lookup `getProfile("football_bulls")`
- Kein Hardcoding in bestehende Strength-Score-Logik. Strength-Score-V2-Berechnung wird als *ein* Modul über eine Adapter-Funktion konsumiert.

### 2. Datenbank (neue Tabellen, alte bleiben unangetastet)
- `performance_profiles_meta` – aktive Profile-IDs pro Org (später erweiterbar).
- `bulls_performance_tests` – Testergebnisse pro Spieler & Test:
  - `id, user_id, org_id, performance_profile, module_id, test_id, variant (bench/squat/…)`
  - `result_value, result_unit, reps, rir, bodyweight_kg`
  - `measurement_method, surface, footwear`
  - `video_path` (Storage), `video_uploaded_at`
  - `verification_status` (`draft|submitted|verified|corrected|rejected`)
  - `verified_by, verified_at, coach_corrected_value, coach_note, rejection_reason`
  - `performed_at, created_at, updated_at`
- `bulls_performance_scores` (materialisiert oder view) – aktueller Modul-Score + Overall Score pro Spieler & Position.
- RLS:
  - Spieler: eigene Rows lesen/schreiben (nur `draft`→`submitted` schreiben).
  - Bulls Coaches (via `has_role` + org membership): alle Rows der Org lesen, Verifizierung schreiben.
  - Andere Spieler: **keine Sicht auf Videos oder Rows anderer** (auch nicht Ranking-Detail).
- Storage-Bucket `bulls-performance-videos` (privat), Policies analog.
- Alle GRANTs mitliefern.

### 3. Spieler-UI (Bulls Hub)
- Navigation: `Strength Check` im Bulls-Kontext entfernen, `Performance Check` hinzufügen.
- Neue Routen:
  - `/bulls/performance` – Übersicht (Score, 4 Module, Position-Bewertung)
  - `/bulls/performance/$moduleId` – Test-Liste eines Moduls
  - `/bulls/performance/$moduleId/$testId` – Testdetail (Anleitung, Historie, „Test durchführen“)
  - `/bulls/performance/$moduleId/$testId/new` – Ergebnis-Erfassung + Video-Upload
- Bulls-Spieler auf `/strength-check` innerhalb Bulls-Kontext → Redirect zu `/bulls/performance`. Generischer Check bleibt für Nicht-Bulls unverändert.

### 4. Coach-UI (Bulls-Coach-Dashboard)
- Neuer Bereich „Performance Checks“ im bestehenden Coach-Dashboard des Vereins:
  - Kennzahlen (offene Prüfungen, getestete Spieler, ⌀-Score, Team-Δ)
  - Liste offener Prüfungen mit Video-Player
  - Aktionen: Bestätigen / Korrigieren / Ablehnen (mit Begründung)
- Rolle: bestehende Bulls-Coach-Berechtigung wiederverwenden (`has_role` + org-membership).

### 5. Score-Berechnung
- Pro Test: 0–100 via positionsgruppen-spezifischer Benchmark-Interpolation (Definition in Profile-Registry, V1 mit hinterlegten Referenzwerten SKILL/HYBRID/LINE/SPECIALIST).
- Pro Modul: Mittelwert der Test-Scores (nur `verified` fließen in offiziellen Score; unverifizierte separat mit „vorläufig“-Badge).
- Overall Bulls Performance Score: gewichtete Summe der Module gemäß Position Group.
- Confidence: HIGH/MEDIUM/LOW je nach Anteil verifizierter & vorhandener Tests.

### 6. Nicht anfassen
- `performance_athlete_*`, `performance_test_*`, `strength_checks`, `strength_check_results` und generischer Strength Score V2 bleiben unverändert und für normale User weiter aktiv.

## Technische Details

- Frontend: TanStack Start file routes unter `src/routes/bulls.performance.*.tsx`, layout mit `<Outlet />`.
- Server-Funktionen unter `src/lib/bulls-performance/*.functions.ts`:
  - `submitPerformanceTest` (Spieler, mit `requireSupabaseAuth`)
  - `uploadPerformanceVideo` – signed upload URL
  - `listPendingVerifications` (Coach)
  - `verifyPerformanceTest`, `correctPerformanceTest`, `rejectPerformanceTest`
  - `getMyPerformanceProfile`, `getPlayerPerformanceProfile`
- Video-Upload: direkt in Storage per signed URL; nur MP4/MOV, Größenlimit serverseitig geprüft.
- Position eines Spielers: aus `bulls_profiles` (bestehendes Feld – falls fehlend, ergänzen).
- Migrationen: eine neue Migration mit Tabellen + GRANTs + RLS + Storage-Bucket.

## Offene Fragen (bitte kurz beantworten, dann starte ich)

1. **Position des Spielers**: Soll die Position (WR/QB/OL/…) beim ersten Aufruf des Performance Checks vom Spieler selbst gesetzt werden, oder darf/muss nur ein Bulls-Coach die Position setzen?
2. **Video-Pflicht**: Ist ein Video-Upload für jedes Ergebnis **verpflichtend** oder darf ein Spieler auch ohne Video einreichen (dann bleibt der Status z. B. „nicht verifizierbar“)?
3. **Umfang V1 jetzt**: Soll ich im ersten Rutsch das **komplette** System bauen (DB + Spieler-UI + Coach-Verifizierung + Score-Berechnung), oder in zwei Schritten:
   - Schritt 1: Profile-Registry + DB + Spieler-UI + Video-Upload + Einreichen
   - Schritt 2: Coach-Verifizierungs-Dashboard + finale Score-Berechnung mit Benchmarks
4. **Benchmarks**: Hast du bereits konkrete Referenzwerte für die vier Position Groups (z. B. „WR 40 yd < 4.6 s = 100“), oder soll ich in V1 mit sinnvollen Football-Standardwerten (aus öffentlichen Kombinen-Daten) starten, die du später überschreiben kannst?
