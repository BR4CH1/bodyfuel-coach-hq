
# Fuely OS – Plan

Vieles der Vision existiert bereits (globaler FAB, Chat mit Memory, Hint Engine für Protein/Wasser/Training/Check-in/Streaks/Motivation, Emotionen). Der Ausbau wird in fokussierte Phasen zerlegt, damit wir nach jeder Phase live testen können.

## Phase 1 – Präsenz & Chat Polish (klein, sofort)

- **Idle-Varianten:** Zufälliger Wechsel zwischen atmen, blinzeln, schaukeln, hüpfen. Nach ~5 Min Inaktivität "Schlafen".
- **Chat-Header** wie beschrieben: „👋 Hallo {Vorname}. Ich bin Fuely. Dein smarter Begleiter …" als Empty-State-Message.
- **Schnellaktionen** auf die 6 gewünschten reduzieren (Ernährung analysieren, Trainingsplan erklären, Fortschritt bewerten, Tagesziele, Motivation, Challenge finden).
- **Vibration** (`navigator.vibrate`) bei neuen Hints auf Mobile.

## Phase 2 – Daten-Toolbelt (Kern für „echte KI")

Statt heute nur Kontext-Injection bekommt Fuely echte Tool-Calls über AI SDK (`google/gemini-3-flash-preview`). Jedes Tool ist ein Server-Fn hinter `requireSupabaseAuth`. Erste Tools:

- `getProfile`, `getGoals`
- `getTodayNutrition`, `getNutritionHistory(days)`
- `getTodayTraining`, `getTrainingHistory(weeks)`, `getPRs`
- `getMeasurements(range)`, `getBodyfatTrend`
- `getStreaks`, `getChallenges`, `getBadges`, `getXp`
- `getCheckinHistory`
- `getCoachMessages`, `getCoachTasks`
- `getTeamContext` (Position, Verein, Verletzungen)
- `navigateTo(path)` — Rückgabewert wird clientseitig ausgeführt (Router navigate)

Damit erfüllt sich Punkt 3 (voller Datenzugriff), 12 (Smart Navigation) und 15 (KI-Coach-Fragen) automatisch.

## Phase 3 – Tagesassistent & Abendreview

- **Morning Brief** (07–10 Uhr, 1×/Tag): Server-Fn `getFuelyDailyBrief` sammelt Kcal-, Protein-, Wasser-, Schritt-Ziel, geplantes Training, Streak, offene Challenge. FAB öffnet automatisch eine Speech-Bubble „Guten Morgen 👋 …" mit CTA „Los geht's" → öffnet Chat mit Brief-Card.
- **Evening Review** (20–22 Uhr, 1×/Tag): ✅/❌ Training, Wasser, Protein, Kalorien + XP + Badges des Tages.
- **Dedup** wie bei bestehender Hint Engine via localStorage.

## Phase 4 – Muster-Analyse (Proaktivität)

Neuer nächtlicher Job `analyze-fuely-patterns` (pg_cron → `/api/public/hooks/analyze-fuely-patterns`):

- Rolling 7/14/30-Tage-Vergleiche pro User
- Regeln: Proteinziel N Tage verfehlt · Trainingslast steigt/fällt >20 % · Gewicht stagniert 14 Tage · Schlaf verschlechtert · Check-ins unregelmäßig · Beintraining ausgelassen · Muskelmasse fällt bei stabilem Gewicht
- Ergebnis landet in neuer Tabelle `fuely_insights (user_id, kind, severity, message, cta_href, created_at, seen_at)`
- FAB pollt `fuely_insights` (bereits vorhandener 5-Min-Tick) und zeigt höchste ungesehene Insight als Bubble.

## Phase 5 – Celebration System

- Zentraler Trigger `celebrateFuely({ kind, title, subtitle })` (neues Gewicht, Trainingsabschluss, Challenge, Badge, Level, Streak).
- Vollbild-Overlay mit Konfetti + Fuely-Sprung (bereits vorhandene `fuely-celebrating` Asset) + optionaler Sound.
- Hooks in `training_sessions` completion, `weekly_checkins`, Streak-Milestone, XP-Level-Up.

## Phase 6 – Coach Intelligence

Neues Coach-Dashboard-Widget „Fuely für Coaches" nutzt dieselbe Insights-Tabelle mit `scope = 'coach'`:

- Häufige Fehlzeiten
- Leistung sinkt (Trainingssession-Volume/RPE)
- Ungewöhnliche Gewichtsänderung
- Fehlende Check-ins
- Verletzungsmeldung
- Dauerhaft niedriges Protein / Hydration

Nur im Performance-Bereich, respektiert Team-/Coach-Assignments.

## Phase 7 – Sprache & Persönlichkeit

- System-Prompt-Refactor: Persona-Sheet (locker, kurz, motivierend, nie belehrend), Emotions-Marker im Antwortformat (`__emotion:happy__` etc.), Frontend parst und setzt Fuely-Emotion im Chat-Header + FAB.
- Sprachausgabe / Voice-Input später über Web Speech API (Phase 8+ / Zukunft).

## Phase 8 – Zukunft (nicht jetzt)

Apple Health / Google Fit / Garmin / Whoop / Oura / Kamera-/Video-/Lebensmittelerkennung — dedizierte Roadmap, sobald Kernphasen stehen.

---

## Technischer Überblick

- **Neue Server-Fns:** `src/lib/fuely-tools.functions.ts` (12–15 Tools), `src/lib/fuely-brief.functions.ts` (Morning/Evening), `src/lib/fuely-insights.functions.ts`.
- **Neuer Cron-Endpoint:** `src/routes/api/public/hooks/analyze-fuely-patterns.ts` (nightly).
- **Neue Tabelle:** `fuely_insights` mit RLS (User sieht eigene; Coach sieht Insights zugewiesener Athleten via `has_coach_access`).
- **AI Layer:** `src/lib/fuely.functions.ts` erweitert um AI-SDK-`tool()`-Definitionen + Gemini-3-Streaming.
- **FAB/Engine:** bereits vorhanden, wird um Idle-Zyklen, Vibration, Insights-Poll und Celebrations erweitert.
- **Chat UI:** Header-Copy, Quick Actions, Emotions-Parser.

---

## Reihenfolge & Rückfrage

Ich schlage vor, wir gehen **1 → 2 → 3 → 4** zuerst (das ist der Kern von „Fuely OS"), danach 5–7. **Phase 2 (Tools) ist die eigentliche Aufwertung** — erst damit hört Fuely auf, generisch zu antworten, und wird zum echten Coach.

Bitte kurz bestätigen:

1. **Reihenfolge okay?** (1→2→3→4→5→6→7) Oder willst du eine Phase vorziehen (z. B. Celebration/Coach zuerst)?
2. **Ton für Fuely:** Duzen, locker, deutsche Sprüche mit gelegentlichem Emoji — passt das oder soll er nüchterner klingen?
3. **Sound bei Celebrations:** ja / nein / erstmal aus, später Toggle im Profil?

Danach starte ich mit Phase 1 + 2 in einem Rutsch.

