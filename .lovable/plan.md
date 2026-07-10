# Bulls Ranglisten-Punkte-Engine — Phasenplan

**Scope**: NUR Coesfeld Bulls (`organization_id = b86f49ab-20b7-42ca-bba4-f65ca8757c4c`).
Keine globale BodyFuel-Engine. Kein Umbau an `get_ranking()`, `performance_points`,
`daily_checks`. `athlete_checkins` bleibt Legacy-Datenquelle für Load-Steuerung.

## Regeln (Referenz)

| # | Kategorie       | Ereignis                                    | Punkte | Limit                     |
|---|-----------------|---------------------------------------------|--------|---------------------------|
| 1 | check_in        | Daily Check-in vollständig                  | +2     | 1×/Tag                    |
| 2 | team_training   | Bulls-Teameinheit abgeschlossen             | +12    | 1×/Session                |
| 3 | training        | Individuelles Training abgeschlossen        | +10    | 1×/Session                |
| 4 | recovery        | Geplante Mobility/Recovery abgeschlossen    | +4     | 1×/Tag                    |
| 5 | rehab           | Rehab-Einheit abgeschlossen                 | +8     | 1×/Session                |
| 6 | nutrition       | Ernährung vollständig getrackt              | +5     | 1×/Tag                    |
| 7 | nutrition       | Ernährungsziel erreicht (±10% kcal, ≥90% P) | +3     | 1×/Tag                    |
| 8 | tasks           | Coach-Aufgabe abgeschlossen                 | +2     | max 3 (=6 Pkt)/Tag        |
| 9 | development     | Performance-Test vollständig abgeschlossen  | +20    | 1×/Test-Session           |
|10 | development     | PB pro Test-Metrik verbessert               | +10    | max 30 Pkt/Test-Session   |
|11 | streak          | Streak-Meilenstein 3/7/14/30 Tage           | +5/15/30/75 | 1×/Meilenstein/Streak |
|12 | challenge       | Bulls Challenge abgeschlossen               | 25/50/75/100 | 1×/Challenge/Spieler  |

**Nicht-Ranglisten**: Readiness, Schlaf, Pain, Stress, Muskelkater, Coach-Bewertung,
Spielstatistiken, Starter-Status. Bleiben für Load-Management sichtbar, geben aber
NIEMALS Ranglisten-Punkte.

## Architektur

Ein zentrales Ledger `bulls_ranking_events`:

```
id, user_id, organization_id (=Bulls-ID), team_id?, category,
event_kind, points, event_date (activity_date), source_type, source_id,
status ('active'|'reversed'), reason, awarded_by, metadata jsonb,
created_at, updated_at
```

Idempotenz-Schlüssel: `UNIQUE (user_id, event_kind, source_type, source_id)`
(bei `source_id IS NULL` → Tages-Idempotenz via zusätzlichem
`UNIQUE (user_id, event_kind, event_date) WHERE source_id IS NULL`).

Storno = neuer Row mit gleichem Bezug UND `status='reversed'` UND negativen
Punkten; Original wird `status='reversed'` gesetzt. Nichts wird hart gelöscht
(Anforderung #21).

`awarded_by` NULL = System, sonst UUID der manuellen Anpassung (Anforderung #23).

## Phasen

### Phase 1 — Schema + Engine-Kern (DIESER TURN)

- Migration:
  - Tabelle `bulls_ranking_events` inkl. Indizes + Idempotenz-Constraints
  - Function `award_bulls_points(...)` (security definer, idempotent)
  - Function `reverse_bulls_points_by_source(source_type, source_id)`
  - Function `recompute_bulls_streak(user_id)` (Meilensteine 3/7/14/30)
  - Function `award_bulls_test_improvements(session_id)` (Regel #10 mit 30-Pkt-Cap)
  - Function `get_bulls_ranking(org_id, since, until, scope_team?, scope_position?)` RPC
  - Function `get_bulls_score_breakdown(user_id, since, until)` RPC
  - RLS + GRANTs
  - `higher_is_better` Spalte an `performance_test_definitions` (falls fehlt)

### Phase 2 — Aktivitäts-Hooks + Server-Fns

- Trigger `athlete_checkins` INSERT (Bulls) → +2 check_in
- Trigger `athlete_training_session` UPDATE status→completed (Bulls):
  - training_type='team_practice' → team_training +12
  - focus IN ('strength','speed','agility','conditioning') OR training_type='individual_training' → training +10
  - focus IN ('mobility','recovery') AND is_rehab=false → recovery +4
  - is_rehab=true → rehab +8
  - anschließend `recompute_bulls_streak(user_id)`
- Trigger `organization_tasks` UPDATE status→completed (Bulls) → +2 tasks (Cap in award-fn)
- Trigger `performance_test_attempts` INSERT (Bulls, valid=true, Session komplett)
  → +20 development + `award_bulls_test_improvements`
- Trigger `food_entries` INSERT/UPDATE → server fn recompute Nutrition-Tag
  (voll getrackt +5, Ziel erreicht +3)
- Trigger `organization_challenge_point_events` INSERT (Bulls) für Challenge-Abschluss
  → 25/50/75/100 anhand Regel-Punkten
- Server-Fns:
  - `getBullsRanking`, `getBullsMyScore`, `getBullsMyHistory`
  - `adjustBullsPointsManual` (nur org-admin, mit audit)

### Phase 3 — UI

- `src/routes/bulls.ranking.tsx`:
  - Zeitraum-Filter (Woche/letzte Woche/Monat/letzter Monat/Saison/Gesamt)
  - Scope-Filter (Gesamt / Team / Offense-Defense-ST / Position)
  - Mein Score + Kategorien-Aufschlüsselung + Streak + Erfüllungsquoten
  - Punkte-Historie (activity_date)
- Nav-Eintrag in `AppLayout.tsx` unter `bulls`-Rolle
- Coach-Cockpit: Manuelle Anpassung nur für `organization_admin`

## Offene Punkte / bewusste Vereinfachungen

- **Rehab-Erkennung**: Wir fügen `is_rehab boolean DEFAULT false` an
  `athlete_training_session` in Phase 2 hinzu (kein Schema-Schub nötig für Phase 1).
- **Position-Buckets** (Offense/Defense/ST/QB/RB/…): Mapping erfolgt in einer
  server-seitigen Helferfunktion in Phase 2, weil `profiles.sport_position`
  Freitext ist. Für Phase 3 UI zunächst Team-Filter + Positions-Freitext.
- **Challenge-Punkte-Bridge**: In Phase 2 hängen wir uns per Trigger an
  `organization_challenge_point_events` — das bestehende Challenge-System
  bleibt Single Source of Truth, wir spiegeln nur ins Bulls-Ledger.
