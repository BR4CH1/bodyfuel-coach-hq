# Phase 1 – Player Cards Fundament

Baut das Datenmodell, die BFR-Berechnung und die Karte inkl. 3D-Flip. Kein Share, kein Coach-Grid, keine Badges — die folgen in späteren Phasen.

## Datenquelle für Attribute

Vorhanden: `bulls_performance_tests` (verifizierte Tests mit `test_id` wie `sprint_40yd`, `broad_jump`, `bench_press_5rm`, `trap_bar_5rm`, `cmj_height`, `a505_left/right`, `rast_6x35m`) sowie `performance_test_attempts` (Framework-Tests). Football-Preset nutzt zunächst die Bulls-Tests, weil dort echte, verifizierte Werte liegen. Fehlende Testkategorien (z.B. 10m Sprint, YoYo, Beep, Pull-Ups) werden als "Noch nicht getestet" gekennzeichnet und der BFR als **Vorläufig** markiert.

Attribut-Mapping (Phase 1):
- **SPD** ← `sprint_40yd`
- **ACC** ← `sprint_10yd` (fällt aktuell auf 40yd-Split zurück wenn kein 10yd)
- **AGI** ← `a505_left`+`a505_right` (Mittelwert)
- **POW** ← `broad_jump` + `cmj_height` (gewichtet)
- **STR** ← `bench_press_5rm` + `trap_bar_5rm` relativ zum Körpergewicht (e1RM Epley)
- **END** ← `rast_6x35m` (bis später YoYo/Beep integriert werden)

Benchmark-Kurven pro Attribut sind seedbar und linear-interpoliert (analog `strengthScoreV2.ts`), Output 0–99.

## Datenbank (Migration)

Vier Tabellen im `public` Schema, alle mit GRANTs + RLS:

- `player_card_position_weights` – Sport/Position → Gewichtung SPD/ACC/AGI/POW/STR/END. Seed: Football-Preset (QB, RB, WR, TE, OL, DL, LB, CB, S) mit den vom User angegebenen Werten. `TO authenticated SELECT`, `TO service_role ALL`.
- `player_card_benchmarks` – Attribut-Key → Ankerpunkte `{value, score}[]` als JSONB. Seed: Football-Kurven.
- `player_cards` – aktuelle Karte pro User: `user_id`, `bfr`, `spd/acc/agi/pow/str/end`, `tier` (bronze/silver/gold/elite/legendary), `is_provisional`, `missing_tests jsonb`, `attributes_detail jsonb`, `computed_at`, `organization_id`, `position_key`.  
  Policies: SELECT eigenes + Org-Staff via `has_role`, INSERT/UPDATE nur `service_role` (server-fn).
- `player_card_history` – Snapshot bei jedem Recompute: `player_card_id`, `bfr`, alle Attribute, `snapshot_at`. Policies analog.

Kartenstufen (Tier) leiten sich aus BFR ab: 40–59 Bronze / 60–69 Silber / 70–79 Gold / 80–89 Elite / 90–99 Legendary.

## Server-Funktionen (`src/lib/player-cards.functions.ts`)

- `recomputePlayerCard({ user_id })` – protected. Lädt neueste verifizierte Tests + Profil (Geburtsdatum, Größe, Gewicht, Position, Team, org, Foto), berechnet Attribute → BFR → Tier, upserted `player_cards`, hängt Snapshot an `player_card_history`. Coach oder eigener Nutzer.
- `getMyPlayerCard()` – protected, liest Karte + letzte 10 History-Punkte für den Verlauf.
- `getPlayerCardForAthlete({ user_id })` – protected, Coach-Access.

Pure Engine unter `src/lib/player-cards/engine.ts` (keine Supabase-Abhängigkeit), testbar analog `strengthScoreV2`.

## UI

- `src/components/player-cards/PlayerCard.tsx` – die eigentliche Karte, orientiert am hochgeladenen Bild:
  - Metallic-Rahmen, dunkler Hintergrund, dynamische Vereinsfarben (aus `organizations` – primary/secondary/text)
  - Links oben große BFR-Zahl + "BFR" Label, Position + Trikotnummer
  - Rechts oben Vereinslogo, seitlich vertikaler Claim
  - Mitte: freigestelltes Spielerbild (Profilbild, `object-cover`, Glow)
  - Unten: Nachname groß in Metallic-Style, Vorname kleiner darüber; Team · Position · #Nummer
  - 6 Attribut-Kacheln (SPD/ACC/AGI/POW/STR/END) mit Icon (lucide), Zahl, 6-Segment-Fortschrittsleiste, "XX PCTL"
  - Kartenstufe · Letztes Update · Grösste Stärke
- `src/components/player-cards/PlayerCardBack.tsx` – Rückseite:
  - BFR-Verlauf (Recharts LineChart aus History)
  - Fortschritt seit letztem Test (Delta pro Attribut)
  - Persönliche Bestleistungen (letzte verifizierte Testwerte pro Testkey)
  - Automatischer Coach-Summary-Text (deterministisch aus den größten Deltas — keine KI in Phase 1)
- `src/components/player-cards/PlayerCardFlip.tsx` – Wrapper mit CSS 3D-Flip (transform-style: preserve-3d, rotateY), klickbar
- Design-Tokens: neue CSS-Variablen in `src/styles.css` für Metallic-Gradient und Tier-Farben (Bronze/Silber/Gold/Elite/Legendary), damit später weitere Vereinsfarben ohne Code-Änderung greifen

## Einbindung

- `src/routes/profile.tsx` und `src/routes/bulls.performance.index.tsx` bekommen einen neuen Bereich **PLAYER CARD** direkt unter den Stammdaten. Loader ruft `getMyPlayerCard` via `ensureQueryData`.
- Fallback wenn noch keine Karte existiert: Button "Karte generieren" → ruft `recomputePlayerCard` und invalidiert Query.

## Bewusst NICHT in Phase 1

Share/Export (PNG/PDF/IG), Coach-Player-Cards-Grid, Badges, Live-Upgrade-Animation, Player/Team of the Month, Ranglisten-Seite, Admin-Editor für Gewichtungen/Benchmarks, Coach-Ratings, weitere Sportart-Presets. Struktur (Tabellen `player_card_position_weights`, `player_card_benchmarks`) ist bereits so gebaut, dass diese in Phase 4 ohne Schemaänderung ergänzt werden.

## Technische Details

- Migration in einem Schub mit CREATE TABLE + GRANT + RLS + POLICY + Seed. Kein Anon-Grant (alle Reads authenticated).
- `recomputePlayerCard` läuft mit `requireSupabaseAuth`, greift für Schreibzugriffe via dynamischem `await import('@/integrations/supabase/client.server')` auf den Service-Role-Client zu (nach Autorisierungscheck).
- 3D-Flip via reines CSS (Tailwind + custom utility `@utility card-flip`), GPU-beschleunigt, `will-change: transform`.
- Mobile-first (Karte skaliert per aspect-ratio 2/3), auf Desktop max-width 480px.
- Tests: kurzer Vitest für Engine (Gewichtung, Interpolation, Tier-Mapping).
