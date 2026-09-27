# Quick Food Log / Food AI — Umsetzungsplan

Freitext oder Sprache wird zu einer prüfbaren Liste von Einträgen, die mit einem Klick im bestehenden Tracker landen. Die KI zerlegt den Text nur. Kalorien und Makros kommen aus dem BodyFuel-Katalog oder werden klar als Schätzung markiert (gemäß Regel: kcal/Makros nur aus BLS, USDA oder Etikett, nicht frei geschätzt).

## 1. Was bereits existiert und wiederverwendet wird

| Baustein | Bestand | Nutzung |
|---|---|---|
| Tracker-Seite | `NutritionTracker.tsx` (genutzt in `/nutrition/tracking`, `/$orgSlug/nutrition/tracking`, `/bulls/nutrition/tracking`, `/tracker/app/nutrition`) | Neue Quick-Log-Karte oben, damit sie automatisch in allen Hubs erscheint |
| Tracker-Status | `useNutritionTracker` + `useAddFoodFlow` (`reloadEntries`, Tagesziele, Tagestyp, Summen) | „Tracken" ruft danach `reloadEntries` auf; Ziel-Vorschau über `targets`/`totals` |
| Einträge | Tabelle `food_entries` (meal, entry_date, name, brand, food_id, serving_amount, amount_unit, serving_g, kcal, P/KH/F, source, image_url) | Einziges Ziel zum Speichern, keine Parallel-Tabelle |
| Katalogsuche | `runCatalogSearch` / `searchFoodsDb`, RPC `search_foods`, `food-search.logic.ts` (deutsche Normalisierung, Synonyme, Komposita) | Matching jeder erkannten Position |
| Aliasse | `food_aliases`, `food_alias_learning` | Umgangssprache → Lebensmittel; Nutzerkorrekturen als Lernsignal |
| Einheiten | `food-units.ts`, `food-piece-sizes.ts`, `nutrition-ingredient-units.ts` | Stück/Scheibe/EL/Handvoll → Gramm mit hinterlegten Stückgewichten |
| Plausibilität | `checkFoodEnergy` (`food-energy.ts`) | Jede Position, auch Schätzungen |
| Eigene Gerichte | `custom_meals` + `meal-macro-truth.ts` | Treffer für „mein Overnight Oats"; Makros kommen aus den Zutaten |
| Schätzung | `estimateFoodFromText` (Einzel-Lebensmittel) | Wird Fallback-Stufe, auf die Gateway-Standards umgestellt |
| Foto-Tracking | `MealPhotoDialog` / `meal-photo.functions.ts` | Gleiches Review-Muster, später dieselbe Review-Karte |
| Tagespunkte | Protein/Wasser-Autocheck in `daily_checks` | Greift automatisch nach dem Speichern |

## 2. Neu zu bauen

- `QuickFoodLogCard` (Texteingabe + Mikrofon + „Analysieren")
- `QuickLogReviewSheet` (Review-Ansicht als Bottom Sheet)
- `quick-food-log.functions.ts` (parse, korrigieren, übernehmen) + `quick-food-log.server.ts` (Matching, Mengen)
- `quick-food-log.logic.ts` (reine Logik: Mengen-Wörterbuch, Datum, Konfidenz, Summen) + Tests
- Transkriptions-Server-Route `src/routes/api/transcribe.ts`
- Tabelle `food_log_drafts` (siehe 3)

## 3. Datenmodell

**Wiederverwendet:** `food_entries` (Ziel), `nutrition_foods`, `food_aliases`, `food_alias_learning`, `custom_meals`.

**Neu: `food_log_drafts`** (ein Parse = eine Zeile)
- `id`, `user_id`, `raw_text`, `input_mode` (text|voice), `status` (parsed|committed|discarded), `parsed` (jsonb: Mahlzeiten → Positionen), `resolved_date`, `created_at`, `committed_at`, `parser_version`
- RLS: nur eigene Zeilen; Coach liest über die bestehende Coach-Kunden-Beziehung (Phase 2)
- Cleanup: nicht übernommene Entwürfe werden nach 7 Tagen per Cron gelöscht

**Erweiterung `food_entries` (additiv, nullable):**
- `log_draft_id uuid` + `log_item_key text`, eindeutig zusammen → verhindert doppeltes Speichern
- `estimate_level text` (exact|matched|estimated)
- `raw_phrase text` (Originalformulierung, Basis für Coach-Insights)
- `source = 'quick_log'`

Keine Audio-Tabelle, kein Speicher-Bucket (siehe 5).

## 4. Parsing- und Matching-Pipeline

```text
Text ──► [0] Vorprüfung ──► [1] KI zerlegt ──► [2] Matching ──► [3] Mengen ──► [4] Nährwerte ──► Review
```

0. **Vorprüfung (ohne KI):** leer, zu lang (> 2.000 Zeichen), identischer Text in den letzten 10 min → gespeicherten Entwurf erneut verwenden (Cache über Hash).
1. **Zerlegen (ein KI-Aufruf, `openai/gpt-6-astra`, Responses, gestreamt, strukturierte Ausgabe):**
   Ausgabe je Position: `phrase`, `food_name_de`, `brand`, `quantity` (Zahl|null), `unit` (g|ml|stueck|scheibe|el|tl|portion|teller|handvoll|glas|flasche|dose|null), `vague_qualifier` (ordentlich, bisschen…), `meal_slot` (breakfast|lunch|dinner|snack|null), `relative_day` (today|yesterday|ISO), `is_dish` (Gericht vs. Einzellebensmittel), `components` bei Gerichten (Schnitzel, Röstzwiebeln, Bratkartoffeln).
   **Keine Nährwerte von der KI in diesem Schritt.** Der Prompt enthält Alltagssprache-Hinweise („reingehauen", „Bierchen" = 0,33 l Bier, „O-Saft" = Orangensaft).
2. **Matching (deterministisch):** Reihenfolge eigene Gerichte → Marke + Name im Katalog (Etikett vor Durchschnitt) → Alias/Lernalias → normale Katalogsuche. Aus Trefferwert + Marken-Übereinstimmung + Zustand (roh/gekocht) ergibt sich die Konfidenz. Zustand wird nie umgerechnet: „Bratkartoffeln" → verzehrfertige Variante; fehlt sie, bleibt die Position als unsicher markiert.
3. **Mengen:** Zahl + Einheit → Gramm/ml über `food-units` und Stückgewichte. Wörterbuch für ungenaue Angaben (Handvoll ≈ 30 g, Teller ≈ 350 g, „ordentlich" = ×1,3 der Standardportion) → immer `estimated`. Flüssigkeiten bleiben in ml.
4. **Nährwerte:** pro 100 g/ml × Menge, intern präzise, gerundet erst in der Anzeige. Nur wenn es keinen Treffer gibt: `estimateFoodFromText` (gebündelt, **ein** Aufruf für alle offenen Positionen) → `estimate_level = estimated`, deutlich gekennzeichnet.
5. **Datum:** `relative_day` wird in der Zeitzone des Nutzers aufgelöst. Die Zukunft ist blockiert, maximal 7 Tage zurück. Weicht das Datum vom angezeigten Tag ab, zeigt das Review einen Hinweis.

**Korrektur-Loop („Die Erdnussbutter waren eher 70 g"):**
- Zuerst ein lokaler Regel-Parser (Name + Zahl + Einheit gegen vorhandene Positionen) → **kein KI-Aufruf**
- Nur bei Mehrdeutigkeit ein kleiner KI-Aufruf mit Entwurf + Korrektursatz → gibt nur geänderte Positionen zurück
- Nur betroffene Positionen werden neu berechnet, der Rest bleibt unverändert

## 5. Audio / Transkription

- Aufnahme im Browser (vollständige WAV-Datei, Maximum 2 min, Pegelanzeige, Stop)
- Upload an `/api/transcribe` (angemeldet, Größenlimit), weiter an den Gateway-Sprach-zu-Text-Dienst (`google/gemini-3.5-transcribe`, deutsch)
- **Audio wird nur im Arbeitsspeicher verarbeitet, nicht gespeichert** und nach der Antwort verworfen
- Das Transkript landet im Textfeld und ist **editierbar**. Erst „Analysieren" startet Schritt 1. So läuft Sprache über denselben Parser.
- Fehlende Mikrofon-Freigabe oder iOS-PWA-Besonderheiten → Hinweis „Bitte tippen"

## 6. Review-UI (mobil zuerst)

```text
[ Heute · 27.09. ▾ ]                         Gesamt 2.140 kcal
Frühstück
  Protein-Grießpudding (Lidl Milbona)   200 g   ✓ Etikett   180 kcal  P20 K18 F3
Mittag
  Zwiebelschnitzel                      ~200 g  ≈ geschätzt  …
  Röstzwiebeln                           ~20 g  ≈ geschätzt
  Bratkartoffeln                        ~250 g  ≈ geschätzt
Snack
  Reiswaffeln                    5 Stück = 40 g ✓
  Erdnussbutter                          100 g  ✓
  Orangensaft                            700 ml ✓
───────────────────────────────────────────────
Tagesziel: 2.140 / 2.400 kcal · P 132/160 · …
[ Korrektur eingeben … ]      [ Tracken ]
```

- Jede Position: Menge mit +/- und Kommazahl, Einheit, Produkt tauschen (vorhandene Suche), Mahlzeit ändern, löschen
- Stufen: grün (Etikett/verifiziert), gelb „geschätzt", rot „unsicher" (kein oder schwacher Treffer)
- **Rote Positionen sperren „Tracken"**, bis sie bestätigt, ersetzt oder entfernt sind. Gelbe erfordern keinen Extra-Klick, bleiben aber markiert.
- Vorschau: Gesamtwerte + Balken „vorher → nachher" gegen die Tagesziele (Tagestyp beachtet)
- Nach dem Speichern: Hinweis, Tracker lädt neu, der Entwurf wird `committed`

## 7. Speichern ohne Duplikate

- Die Server-Funktion `commitFoodLog(draftId, items)` prüft den Besitzer und `status = parsed` und schreibt alle Einträge in **einer** Datenbank-Funktion (Transaktion) mit `log_draft_id` + `log_item_key`
- Eindeutiger Index + `on conflict do nothing` → erneutes Bestätigen oder Doppelklick erzeugt nichts Neues; die Antwort meldet „bereits getrackt"
- Werte werden serverseitig aus Katalog + Menge neu berechnet. Vom Browser gesendete kcal gelten nicht als Wahrheit.

## 8. Edge Cases

- Marke unbekannt → allgemeiner Treffer + Hinweis „Marke nicht im Katalog"
- Gericht ohne Rezept → Aufteilung in Bestandteile, jeder Teil geschätzt
- Getränke/Alkohol („Bierchen", „Radler") → ml, Alkohol-kcal über Katalog
- „nichts gegessen", reine Fragen, Nicht-Lebensmittel → leeres Ergebnis mit freundlichem Hinweis, kein Speichern
- Mehrere Tage in einem Text → Positionen je Datum gruppiert
- Unrealistische Mengen (5 kg, 0 g) → rote Markierung
- Wiederholungen („wie gestern Frühstück") → Phase 2
- KI-Fehler: 402/429 → klare Meldung, Text bleibt erhalten, keine automatische Wiederholung (außer begrenzt bei 429/5xx)
- Offline/PWA → Text bleibt als lokaler Entwurf erhalten
- Organisations-Hubs (Bulls/SGZ/Padellers) → gleicher Tracker, keine Sonderfälle

## 9. Sicherheit & Datenschutz

- Alle Server-Funktionen erfordern eine Anmeldung. `user_id` kommt immer aus der Sitzung, nie vom Browser.
- RLS auf `food_log_drafts` (eigene Zeilen), gezielte Freigaben, kein anonymer Zugriff
- Audio: kein Speichern, kein Log, Größen- und Dauerlimit
- Rohtexte: Entwürfe nach 7 Tagen gelöscht. `raw_phrase` bleibt nur an übernommenen Einträgen (für die Coach-Transparenz), auf Wunsch abschaltbar.
- Prompt-Injection: Nutzertext nur als Daten, strukturierte Ausgabe mit Schema-Prüfung (Zod), Server berechnet alle Zahlen
- Tempolimit: z. B. 30 Analysen pro Nutzer und Tag

## 10. Kosten & Performance

- Normalfall: **1 KI-Aufruf** (Zerlegen), optional 1 gebündelte Schätzung; Korrekturen meist ohne KI
- Cache identischer Texte, Matching und Rechnen deterministisch in der Datenbank
- Gestreamte Antwort → Positionen erscheinen schrittweise im Review
- Transkription nur auf ausdrücklichen Klick auf den Mikrofon-Button

## 11. MVP vs. Phase 2

**MVP**
- Textfeld + Mikrofon auf allen Tracker-Seiten
- Zerlegen, Matching, Mengen, Datum (heute/gestern/Mahlzeit)
- Review mit Markierungen, Bearbeiten, Tauschen, Löschen, Ziel-Vorschau
- Korrektur-Loop (erst Regeln, dann KI)
- Speichern ohne Duplikate, Audio wird nicht gespeichert, Entwürfe werden aufgeräumt
- Tests: Mengen-Wörterbuch, Datum, Konfidenz, Duplikatschutz, Summen

**Phase 2**
- Lernen aus Korrekturen → `food_alias_learning` (nutzerbezogene Standardportionen)
- „wie gestern", Favoriten-Kurzbefehle, Mischung mit Foto-Tracking
- Coach-Insights: Anteil Schätzungen, typische Lücken, Fuely-Hinweise auf Basis von `raw_phrase`/`estimate_level`
- Live-Transkription beim Sprechen, Siri/Share-Shortcut
- Hinweis an den Coach bei fehlenden Katalogeinträgen → Katalog erweitern

## Technische Details

- Server-Funktionen in `src/lib/quick-food-log.functions.ts` mit `requireSupabaseAuth`; Admin-Client nur für den Cron-Cleanup
- KI über den Gateway (`/v1/responses`, `openai/gpt-6-astra`, `store:false`, Reasoning `low`, strenges JSON-Schema); `estimateFoodFromText` wird dabei auf denselben Standard umgestellt
- Transkription: `/v1/audio/transcriptions`, multipart, `stream:"true"`, Server-Route liefert SSE an den Client
- Migration: `food_log_drafts` (+ Freigaben + RLS), `food_entries` additive Spalten + eindeutiger Teilindex `(log_draft_id, log_item_key)`, RPC `commit_food_log(draft_id, items jsonb)`, Cron-Cleanup
- Protein-Cap/Carb-Shifting betreffen nur Planziele, nicht das Tracking; unverändert
- Nichts veröffentlichen
