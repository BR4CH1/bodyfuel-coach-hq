## Ziel
Kunden tippen auf eine Mahlzeit im Ernährungsplan und sehen Zutaten + Zubereitung. Die KI generiert das Rezept einmalig automatisch und speichert es, damit es beim nächsten Tap sofort da ist.

## So funktioniert es für den Nutzer
- In der Plan-Ansicht erscheint neben jedem Mahlzeit-Eintrag ein kleines Info-Icon.
- Tap → Modal öffnet sich mit:
  - Mahlzeit-Name & Makros
  - **Zutaten** (Liste mit Mengen, abgestimmt auf die hinterlegten Kalorien/Makros)
  - **Zubereitung** (kurze Schritt-für-Schritt-Anleitung)
- Beim ersten Tap erscheint kurz „Rezept wird erstellt…" (1–2 Sek.), danach ist es dauerhaft gespeichert — auch für andere Kunden mit derselben Mahlzeit.
- Der „Tracken"-Button bleibt unverändert; das Rezept-Modal ist ein eigener Tap und löst kein Tracking aus.

## Coach-Sicht
- Keine Pflege nötig. Wenn ein Rezept mal nicht passt, kann der Coach im Modal auf „Neu generieren" tippen — das überschreibt das gespeicherte Rezept.

## Technisch (Kurzform)
- Neue Spalten in `nutrition_plan_meals`: `recipe_ingredients` (text[]), `recipe_steps` (text[]), `recipe_generated_at` (timestamptz).
- Server-Funktion `generateMealRecipe` (Lovable AI, Gemini Flash) — bekommt Name, Beschreibung, Makros; gibt strukturiertes JSON zurück; schreibt es in die Zeile.
- `PlanContentView`: Info-Button pro Meal, Dialog lädt vorhandenes Rezept oder triggert Generierung on-demand. Coach sieht zusätzlich „Neu generieren".

## Kosten
Pro Rezept ein KI-Aufruf (~Cent-Bruchteile). Da gecacht wird, fällt das nur einmal pro Mahlzeit an.

## Nicht enthalten
- Bilder zu Mahlzeiten (separater Wunsch).
- Bulk-Vorabgenerierung aller bestehenden Mahlzeiten (kann ich auf Wunsch nachschieben).
