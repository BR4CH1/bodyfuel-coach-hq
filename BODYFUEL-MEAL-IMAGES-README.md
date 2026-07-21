# BodyFuel: eigene Mahlzeiten und Mahlzeitenfotos

Dieses Overlay ergänzt den bestehenden BodyFuel-Stand um einen vollständigen
Mahlzeitenfoto-Fluss:

- Eigene Mahlzeiten werden ausschließlich aus aktiven, geprüften
  `nutrition_foods` zusammengestellt.
- Die Nährwerte werden beim Speichern serverseitig erneut aus der Datenbank
  berechnet.
- Nach dem Speichern wird automatisch ein passendes Gerichtsfoto generiert.
- Plan-Mahlzeiten erhalten ihr Foto beim ersten Anzeigen nacheinander im
  Hintergrund; Bilder aus der Coach-Mahlzeitenbibliothek werden wiederverwendet.
- Produkt- und Mahlzeitenbilder erscheinen in Suche, Mengenansicht,
  Plan-Karten, Rezeptansicht, eigenen Mahlzeiten und im Ernährungstagebuch.
- Beim Tracken wird die Bild-URL als Snapshot in `food_entries` gespeichert.
  Spätere Rezeptänderungen verändern den alten Tagebucheintrag daher nicht.
- Falls die Bildgenerierung vorübergehend nicht erreichbar ist, bleibt die
  Mahlzeit gespeichert. Wenn vorhanden, wird vorläufig ein Zutatenfoto gezeigt.

## Overlay im Terminal übernehmen

```bash
cd /workspaces/bodyfuel-coach-hq
unzip -o /pfad/zu/bodyfuel-meal-images-overlay.zip -d .
npm ci
```

Danach die neue Supabase-Migration ausführen:

```bash
npx supabase db push
```

Die Migration erstellt beziehungsweise erweitert die Bildfelder und legt den
öffentlichen Storage-Bucket `meal-images` an. Darin liegen nur generische
Produkt-/Gerichtsbilder, keine Profilfotos oder privaten Nutzerdokumente.

## Server-Konfiguration

Für echte AI-Fotos muss `LOVABLE_API_KEY` als Server-Secret gesetzt sein. Das
Projekt verwendet diesen Key bereits für andere AI-Funktionen. Der Key gehört
nicht in Git und ist bewusst nicht in dieser ZIP enthalten. Ohne Key funktioniert
das Speichern weiterhin; die Oberfläche verwendet dann ein vorhandenes
Zutatenfoto oder einen Platzhalter.

Die bereits benötigten Variablen `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` und
`SUPABASE_SERVICE_ROLE_KEY` müssen ebenfalls serverseitig vorhanden sein.

## Prüfen

```bash
npx vitest run src/lib/__tests__/meal-image.logic.test.ts \
  src/features/nutrition-tracker/lib/__tests__/nutrition-tracker.logic.test.ts \
  src/features/nutrition-plan-builder/lib/__tests__/plan-builder.logic.test.ts
npm run build
```

Im gelieferten Stand sind diese 12 gezielten Tests grün und der
Produktions-Build läuft erfolgreich durch. Der vollständige vorhandene
Testsatz hat unabhängig von diesem Overlay drei datumsabhängige Fehler im
Coach-Dashboard. `npm run typecheck` meldet außerdem bereits vorhandene Fehler
im Coach-Dashboard-Modell sowie in `src/routes/fuely.tsx`; die neuen
Mahlzeitenbild-Dateien erzeugen keine TypeScript-Fehler.

## Commit und Push

```bash
git status --short
git add \
  BODYFUEL-MEAL-IMAGES-README.md \
  supabase/migrations/20260721203000_custom_meal_images.sql \
  src/components/bodyfuel/BullsPlanContentView.tsx \
  src/components/bodyfuel/CustomMealsCard.tsx \
  src/components/bodyfuel/DayPlanView.tsx \
  src/components/bodyfuel/MealBuilderDialog.tsx \
  src/components/bodyfuel/MealImageThumb.tsx \
  src/components/bodyfuel/PlanContentView.tsx \
  src/components/bodyfuel/RecipeDialog.tsx \
  src/components/bodyfuel/useAutoGeneratePlanMealImages.ts \
  src/features/nutrition-tracker/components/CustomMealsPanel.tsx \
  src/features/nutrition-tracker/components/FoodAmountEditor.tsx \
  src/features/nutrition-tracker/components/NutritionTrackerSections.tsx \
  src/features/nutrition-tracker/hooks/useAddFoodFlow.ts \
  src/features/nutrition-tracker/hooks/useNutritionTracker.ts \
  src/features/nutrition-tracker/types.ts \
  src/integrations/supabase/types.ts \
  src/lib/__tests__/meal-image.logic.test.ts \
  src/lib/custom-meals.functions.ts \
  src/lib/meal-image.logic.ts \
  src/lib/meal-images.functions.ts \
  src/lib/nutrition.functions.ts \
  src/lib/plan-builder.functions.ts
git commit -m "feat: add generated meal images to plans and tracking"
git push
```
