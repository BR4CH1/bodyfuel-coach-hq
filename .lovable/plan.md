# BodyFuel Smart Nutrition System (KI 2.0)

Großes Feature-Paket. Ich schlage 5 klar abgegrenzte Phasen vor, die aufeinander aufbauen. Sag mir am Ende, in welcher Reihenfolge / wie viel auf einmal — empfohlen ist **Phase 1 + 2 zuerst**, weil ohne Profil-Daten die KI nichts Neues lernen kann.

---

## Phase 1 — Smart-Nutrition-Profil & 60-Sek-Onboarding

**Backend (neue Tabelle `smart_nutrition_profile`, 1 Zeile pro User):**
- `favorite_foods text[]`, `nogo_foods text[]`, `allergies text[]`
- `extra_favorites text`, `extra_nogos text`, `extra_allergies text`
- `meal_prep_style` (`daily` / `2_3_week` / `meal_prep` / `low_effort`)
- `shopping_day` (`monday`..`sunday`), `shopping_lead_days int default 1`
- `budget_band` (`<50`, `50_75`, `75_100`, `>100`)
- `auto_publish boolean default false` (Coach-Freigabe Standard)
- `completed_at timestamptz` — nur gesetzt wenn Onboarding fertig
- RLS: User liest/schreibt eigenes Profil; Coach liest alle

**Frontend:**
- Neuer Wizard `/onboarding/smart-nutrition` (6 Schritte, je < 10 Sek)
- Auto-Trigger: Wenn eingeloggter Client **und** `completed_at IS NULL`, einmal Modal/Redirect anzeigen (überspringbar — kommt aber wieder)
- Abschluss-Screen mit Bestätigung

---

## Phase 2 — KI berücksichtigt Profil-Daten (Mahlzeitentausch & Rezept-aus-Zutaten)

Erweitere bestehende `suggestMealSwaps` + `generateRecipeFromIngredients`:
- **Harte Filter (Priorität 1-2)**: Allergien + No-Go's → vorher prompten, plus Post-Filter nach Name (Substring-Check) → wenn KI doch was Verbotenes vorschlägt, wird's serverseitig verworfen.
- **Soft-Signals**: Lieblings-/Bewertungs-/Favoriten-Daten + Meal-Prep-Stil + Budget-Band fließen in den Prompt ein.
- Hinzu: `mealPrepStyle` beeinflusst Aufwand-Hinweis ("schnell, max 15 Min" vs. "Meal-Prep-tauglich").

---

## Phase 3 — Skip-Tracking ("Warum nicht gegessen?")

**Backend (neue Tabelle `meal_skips`):**
- `user_id`, `meal_id`, `skip_date`, `reason` (`no_time` / `disliked` / `no_ingredients` / `out` / `forgot` / `other`), `note text`
- Indexiert über `meal_id` + `user_id`

**Frontend:**
- In `PlanContentView`: pro Mahlzeit Button "Übersprungen" → Bottom-Sheet mit Grund-Auswahl
- Skips fließen als weiteres Signal in den KI-Tausch-Prompt ein

---

## Phase 4 — Coach Dashboard: Smart Insights + Risiko-Analyse

**Backend (neue Server-Fns):**
- `getCustomerSmartProfile(user_id)` → Profil + Einkaufstag + nächste Liste + nächster Planwechsel
- `getCustomerRiskFlags(user_id)` → berechnet aus den letzten 14 Tagen:
  - viele Skips (> 30 % der Mahlzeiten)
  - viele Swaps (> 30 %)
  - Einkaufsliste nie geöffnet (Event-Log)
  - Protein-Ziel-Verfehlung (aus `food_entries` vs `nutrition_targets.protein_g`)
  - Wenig Aktivität (< 3 Tracking-Tage / 14)

**Frontend:**
- Neue Karte `SmartNutritionInsightsCard` auf `/coach/customers/$userId` mit Profil-Daten + Risiko-Flags
- Auto-Publish-Toggle pro Kunde (oder global im Coach-Settings)

---

## Phase 5 — Automatischer Planwechsel + Einkaufsliste pro Woche

- pg_cron läuft täglich → für jeden User mit aktivem Plan + Smart-Profil:
  - 2 Tage vor `shopping_day` → KI erzeugt neuen Plan-Entwurf (Status `draft`)
  - 1 Tag vor `shopping_day` → Einkaufsliste wird sichtbar / Mail
  - Am `shopping_day` → bei `auto_publish=true` neuer Plan automatisch aktiv; sonst wartet auf Coach-Freigabe
- Neue Coach-Inbox "Pläne freigeben"
- Community-Auswertung im Admin (`/coach/insights/community`): Top 10, Flop 10, Top Kategorien, häufigste Swaps (nutzt schon existierendes `getCommunityRecipeInsights` + Erweiterung)

---

## Was schon existiert (wird wiederverwendet, nicht neu gebaut)
- ❤️ Favoriten, ⭐ Bewertungen, 🔄 Mahlzeitentausch mit ±5 % Filter, Coach-Insights-Karte, manuelle Einkaufsliste, Rezept-aus-Zutaten → alles aus dem letzten Bundle.

---

## Frage an dich
**Wie weit soll ich gehen?**
1. Nur **Phase 1 + 2** (Onboarding-Wizard + KI nutzt Profil-Daten — sofortiger spürbarer Effekt, kleine Änderung) ← **empfohlen**
2. **Phase 1–4** (alles außer Cron-Automatik — Coach sieht Profil & Risiken)
3. **Alles inkl. Phase 5** (auto Planwechsel, größer, mehr Edge-Cases mit pg_cron)
