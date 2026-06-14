# BodyFuel: Rezept-Intelligence-System

Das ist ein großes Feature-Bundle. Ich schlage vor, es in **4 Phasen** umzusetzen, damit jede Phase einzeln testbar und nutzbar ist, bevor wir die nächste bauen. Du kannst auch sagen "alles auf einmal" — dann mache ich Phase 1–4 hintereinander.

---

## Phase 1 — Fundament: Favoriten + Bewertungen ⭐❤️

**Datenbank (neue Tabellen):**
- `meal_favorites` (user_id, meal_id, created_at) — pro Kunde gespeicherte Lieblingsrezepte
- `meal_ratings` (user_id, meal_id, stars 1–5, comment, created_at, updated_at)
- `meal_interactions` (user_id, meal_id, kind: 'shown' | 'eaten' | 'swapped', created_at) — Tracking-Events fürs spätere KI-Lernen

Alle mit RLS: jeder Nutzer sieht/ändert nur eigene Daten; Coach sieht via `has_role` die eigener Kunden.

**UI Kunde:**
- Im `RecipeDialog`: ❤️ Favorit-Button (Toggle) + ⭐ 1–5 Sterne + optionales Kommentarfeld
- Neue Route `/nutrition/favorites` → Grid mit Bild, Name, Kalorien, Makros, eigener Bewertung
- Sortierung: zuletzt gespeichert / höchste Bewertung / meist gegessen
- Filter: Frühstück / Mittag / Abend / Snack (über vorhandenen `slotFromName`)
- Suche nach Rezeptname

**Auto-Tracking:**
- Beim Öffnen eines Rezepts → `shown`-Event
- Beim Tracken einer Plan-Mahlzeit (`toggleMeal`) → `eaten`-Event

---

## Phase 2 — KI-Gerichtetausch 🔄

**Server-Function** `swapMeal` (Lovable AI, gemini-3-flash):
- Input: aktuelle Mahlzeit (kcal/P/K/F) + Kunden-Kontext (Favoriten, Bewertungen, Unverträglichkeiten aus `nutrition_targets`/`profiles`)
- Prompt: "Schlage 5 Alternativen vor, max ±5 % von den Original-Makros, bevorzuge Kategorien, die der Kunde mag, vermeide schlecht bewertete."
- Strukturierte Ausgabe (Zod): Liste von `{name, kcal, p, c, f, beschreibung, kategorie}`
- Vor Anzeige: Filter härtet ±5 % nochmal serverseitig

**UI:**
- Button `🔄 Mahlzeit tauschen` neben jeder Mahlzeit in `PlanContentView`
- Dialog mit Vorschlägen → bei Auswahl: alte Mahlzeit ersetzen für heute (food_entry mit neuer Mahlzeit), `swapped`-Event loggen
- Originalplan bleibt unangetastet — nur der heutige Track wird ersetzt

---

## Phase 3 — Coach-Dashboard: Rezept-Insights 👨‍💻

Im bestehenden `coach.customers.$userId` neuer Tab **"Rezept-Insights"**:
- Top 5 Lieblingsrezepte (höchste Bewertung)
- Bottom 5 unbeliebte Rezepte
- ⌀ Bewertung, Anzahl bewertet, Anzahl Favoriten
- Lieblings-/unbeliebte Kategorien (aus Rezeptnamen abgeleitet)
- Meist getauschte vs. meist gegessene Mahlzeiten

Im Admin/Coach-Übersicht: **Community-Auswertung** — Top 10 / Flop 10 aller Kunden aggregiert.

---

## Phase 4 — Einkaufsliste + "Rezept aus Zutaten" 🛒🥕

- Button `🛒 Einkaufsliste erstellen` auf Ernährungs-Seite
- Server-Function aggregiert alle Mahlzeiten der gewählten Woche → KI parst Zutaten + summiert Mengen
- Anzeige mit Checkboxen, druckbar
- Bonus-Button `🥕 Rezept aus meinen Zutaten` → KI-Rezept-Generator (Zutaten-Input → vollständiges Rezept mit Makros)

---

## Technisch (kurz)

- Backend: TanStack `createServerFn` + Lovable AI (gemini-3-flash-preview, keine zusätzlichen Keys nötig)
- Frontend: neue Routen unter `/nutrition/*`, Erweiterungen in `RecipeDialog.tsx` und `PlanContentView.tsx`
- Alle neuen Tabellen mit RLS + GRANTs

---

## Frage an dich

**Welche Phase soll ich zuerst bauen?** Empfehlung: **Phase 1 + 2 zusammen** (Favoriten/Bewertungen + KI-Tausch) — das ist der Kern-Wow-Effekt für deine Kunden. Phase 3 (Coach-Insights) und Phase 4 (Einkaufsliste) bauen darauf auf, sobald erste Bewertungsdaten da sind.

Oder soll ich **alles in einem Rutsch** machen? Das dauert länger, aber du hast direkt das ganze System.