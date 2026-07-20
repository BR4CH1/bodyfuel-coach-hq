import {
  buildAiSchedule,
  buildPlanSchedule,
  expandFoodTerms,
  resolveGoalDirection,
  resolveNutritionTargets,
} from "@/features/nutrition-plan-ai/lib/plan.logic";
import type {
  GenerateNutritionPlanOpts,
  MealWishSource,
  NutritionPlanGenerationContext,
  NutritionPlanSourceData,
  SafeFoodSource,
  SmartNutritionProfileSource,
  WeightMeasurementSource,
} from "@/features/nutrition-plan-ai/types";
import { daysUntilNextShopping } from "@/lib/shopping-cycle";

const COOKING_DEVICES = [
  "herd",
  "stove",
  "ofen",
  "backofen",
  "oven",
  "airfryer",
  "air fryer",
  "heißluft",
  "mikrowelle",
  "microwave",
  "kochplatte",
  "induktion",
  "gas",
  "grill",
  "thermomix",
  "reiskocher",
  "wasserkocher",
  "kettle",
  "dampfgarer",
  "slow cooker",
  "instant pot",
  "multikocher",
  "pfanne",
  "topf",
] as const;

const TRAINING_GOAL_LABELS: Record<string, string> = {
  muscle_gain: "Muskelaufbau",
  weight_loss: "Abnehmen / Fettabbau",
  recomp: "Recomposition (Fett↓ / Muskel↑)",
  maintain: "Gewicht halten",
  strength: "Kraftsteigerung",
  performance: "Leistungssteigerung",
  health: "Gesundheit & Wohlbefinden",
};

function parseExtraList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildPlateauNote(weightSeries: WeightMeasurementSource[], now: Date): string {
  const currentWeight = weightSeries[0]?.weight_kg ?? null;
  if (weightSeries.length < 2 || currentWeight == null) return "";

  const nowMs = now.getTime();
  const olderReference = weightSeries.find((measurement) => {
    const ageDays = (nowMs - new Date(measurement.measured_at).getTime()) / 86_400_000;
    return ageDays >= 10 && ageDays <= 21 && measurement.weight_kg != null;
  });
  if (olderReference?.weight_kg == null) return "";

  const difference = Number((currentWeight - olderReference.weight_kg).toFixed(2));
  if (Math.abs(difference) > 0.3) return "";

  const days = Math.round((nowMs - new Date(olderReference.measured_at).getTime()) / 86_400_000);
  return `⚠️ GEWICHTSPLATEAU erkannt: Gewicht stagniert seit ~${days} Tagen (Δ ${difference > 0 ? "+" : ""}${difference} kg). Passe Kalorien & Portionen um −100 bis −200 kcal/Tag an (bei Fettabbau-Ziel) bzw. +100 bis +200 kcal/Tag (bei Aufbau). Wähle bewusst sättigendere/energieärmere Alternativen (mehr Volumen, mehr Protein, weniger versteckte Fette) bzw. energiedichtere Optionen bei Aufbau. Halte die unten genannten Tagesziele weiterhin innerhalb ±5 %.`;
}

function resolveKitchenRestrictions(profile: SmartNutritionProfileSource) {
  const equipment = Array.isArray(profile.kitchen_equipment) ? profile.kitchen_equipment : [];
  const notes = (profile.kitchen_equipment_notes ?? "").toString().trim();
  const equipmentLower = equipment.map((entry) => entry.toLowerCase());
  const notesLower = notes.toLowerCase();
  const hasCookingDevice = equipmentLower.some((entry) =>
    COOKING_DEVICES.some((device) => entry.includes(device)),
  );
  const notesIndicatesNoCook =
    /\b(keine k(ü|ue)che|nur k(ü|ue)hlschrank|alles\s+(muss\s+)?kalt|no[- ]?cook|kein herd|kein ofen|nichts kochen|nicht kochen)\b/.test(
      notesLower,
    );
  const isNoCook =
    (equipment.length > 0 || notes.length > 0) && (!hasCookingDevice || notesIndicatesNoCook);

  const equipmentBlock =
    equipment.length || notes
      ? `\n🍳 KÜCHENAUSSTATTUNG (HARTE EINSCHRÄNKUNG — nur Rezepte vorschlagen, die mit diesen Geräten zubereitbar sind):\n${
          equipment.length
            ? `Verfügbare Geräte: ${equipment.join(", ")}`
            : "(keine Liste vom Coach)"
        }${notes ? `\nCoach-Notiz: ${notes}` : ""}\nWenn z. B. KEIN HERD verfügbar ist, dürfen Rezepte nicht „in der Pfanne anbraten" o. ä. verlangen — Garmethode an Airfryer/Backofen/Mikrowelle anpassen.\n`
      : "";

  const noCookBlock = isNoCook
    ? `\n\n🧊🧊🧊 ABSOLUTE NO-COOK-REGEL (HÖCHSTE PRIORITÄT — überschreibt alle anderen Vorschläge):
Der Kunde hat KEINE Garmethode verfügbar (nur Kühlschrank / alles muss kalt aus dem Supermarkt verzehrbar sein).

❌ STRIKT VERBOTEN — auch nicht mit dem Zusatz "(kalt)" oder "vorgekocht":
- Nudeln, Reis, Kartoffeln, Quinoa, Bulgur, Couscous, Linsen-Trockenware (egal ob "gekocht, kalt" deklariert)
- Rohes Fleisch, rohes Hackfleisch, Hähnchenbrust roh, Fisch roh
- Eier (jeder Art — auch hartgekocht zählt NICHT als no-cook)
- Tiefkühlware, die aufgetaut oder gegart werden muss (TK-Gemüse, TK-Fisch, TK-Hähnchen, TK-Beeren NUR ok wenn als gefroren in Skyr/Joghurt eingerührt)
- Alles, was die Worte „gekocht", „angebraten", „gebacken", „gegrillt", „erhitzt", „aufgewärmt" enthält

✅ NUR ERLAUBT (fertig vom Supermarktregal / aus der Kühltheke):
- Aufschnitt aus der Wurst-/Kühltheke: gekochter Schinken, Putenbrust-Aufschnitt, Bresaola, Salami, Mortadella, Roastbeef-Aufschnitt
- Räucherlachs, Räucherforelle, geräucherte Makrele
- Thunfisch / Sardinen / Makrele aus der Dose
- Skyr, Quark, Naturjoghurt, griechischer Joghurt, Hüttenkäse, Frischkäse, Käse (Scheiben, Gouda, Mozzarella, Feta)
- Fertig gekochte Linsen/Kichererbsen/Bohnen/Mais aus Dose oder Beutel
- Hummus, Guacamole-Fertig, Tzatziki
- Brot, Brötchen, Wraps, Tortillas, Knäckebrot, Reiswaffeln
- Frisches Obst & Gemüse zum Rohverzehr (Salat, Gurke, Tomate, Paprika, Möhre, Apfel, Banane, Beeren)
- Salat-Fertigmischungen
- Haferflocken / Müsli als Overnight Oats (in Milch/Joghurt einweichen, NICHT kochen)
- Proteinpulver, Proteinriegel, Proteinshakes, Proteinpudding
- Beef Jerky, Nüsse, Nussmus, Trockenfrüchte
- Milch, Pflanzendrinks, Skyr-Drinks

Jede Mahlzeit MUSS aus dieser Erlaubt-Liste komponiert sein. Wenn du im Description-Feld auch nur EIN Wort wie "gekocht", "gebacken", "angebraten", "gegart" verwendest, ist der Plan FALSCH. Beispiele für gültige No-Cook-Mittagessen: „150g Putenbrust-Aufschnitt, 60g Vollkornbrot, 30g Hüttenkäse, 100g Tomate, 50g Gurke" oder „200g Thunfisch (Dose, abgetropft), 150g Kichererbsen (Dose), 100g Paprika, 50g Mais, 1 EL Olivenöl".\n`
    : "";

  return { isNoCook, equipmentBlock, noCookBlock };
}

function buildSafeFoodBlock(safeFoods: SafeFoodSource[]): string {
  const lines = safeFoods
    .map((food) =>
      food.aliases.length
        ? `- ${food.text_id} | ${food.name} (aka ${food.aliases.slice(0, 3).join(", ")})`
        : `- ${food.text_id} | ${food.name}`,
    )
    .join("\n");
  if (!lines) return "";

  return `\n✅ GESCHLOSSENER LEBENSMITTEL-KATALOG (SAFE FOOD POOL — HART):
Jede Zutat MUSS ein Feld "food_id" haben, dessen Wert exakt einer text_id aus dieser Liste entspricht. Keine anderen Lebensmittel — auch keine ähnlichen Synonyme, keine Marken, keine Freitext-Neuerfindungen. Wenn eine Wunsch-Zutat fehlt, wähle die nächstpassende text_id aus dieser Liste.

Format je Zeile: text_id | Kanonischer Name (aka Alias1, Alias2)
${lines}
`;
}

function buildWishesBlock(wishes: MealWishSource[]): string {
  const approvedWishes = wishes.map((wish) => wish.wish).filter(Boolean);
  if (!approvedWishes.length) return "";
  return `\n⭐ COACH-FREIGEGEBENE WUNSCHGERICHTE (PFLICHT — JEDES MUSS mindestens einmal als eigenständige Mahlzeit im Plan vorkommen; der "name" der Mahlzeit muss den jeweiligen Wunsch enthalten; passe Beilagen/Portionen an die Makros an; sind es mehr Wünsche als Tage, kombiniere mehrere Wünsche pro Tag):\n${approvedWishes.map((wish, index) => `  ${index + 1}. ${wish}`).join("\n")}\n`;
}

export function buildNutritionPlanGenerationContext(input: {
  source: NutritionPlanSourceData;
  opts: GenerateNutritionPlanOpts;
  now?: Date;
}): NutritionPlanGenerationContext {
  const { source, opts } = input;
  const now = input.now ? new Date(input.now) : new Date();
  const profile = source.profile;
  const clientProfile = source.clientProfile;
  const currentWeight = source.weightSeries[0]?.weight_kg ?? null;
  const goalWeight = clientProfile.goal_weight_kg ?? null;
  const height = clientProfile.height_cm ?? null;
  const gender = clientProfile.gender ?? null;
  const ageYears = clientProfile.birthdate
    ? Math.floor(
        (now.getTime() - new Date(clientProfile.birthdate).getTime()) /
          (365.25 * 24 * 3_600 * 1_000),
      )
    : null;
  const activityLevel = clientProfile.activity_level ?? null;
  const coachingGoal = clientProfile.coaching_goal ?? null;
  const trainingGoal = clientProfile.training_goal ?? null;
  const goalDirection = resolveGoalDirection({
    trainingGoal,
    currentWeight,
    goalWeight,
    coachingGoal,
  });
  const { training: trainingTargets, rest: restTargets } = resolveNutritionTargets({
    source: source.targets,
    currentWeight,
    height,
    ageYears,
    gender,
    activityLevel,
    goalDirection,
  });

  const allergyList = [...(profile.allergies ?? []), ...parseExtraList(profile.extra_allergies)];
  const nogoList = [...(profile.nogo_foods ?? []), ...parseExtraList(profile.extra_nogos)];
  const expandedAllergies = expandFoodTerms(allergyList);
  const expandedNogo = expandFoodTerms(nogoList);
  const forbidden = [...expandedAllergies, ...expandedNogo]
    .map((entry) => entry.toLowerCase().trim())
    .filter(Boolean);
  const favoriteFoods = [
    ...(profile.favorite_foods ?? []),
    ...parseExtraList(profile.extra_favorites),
  ];

  const liked = source.ratings
    .filter((rating) => rating.stars >= 4)
    .map((rating) => rating.meal?.name)
    .filter((name): name is string => Boolean(name));
  const disliked = source.ratings
    .filter((rating) => rating.stars <= 2)
    .map((rating) => rating.meal?.name)
    .filter((name): name is string => Boolean(name));
  const favoriteNames = source.favorites
    .map((favorite) => favorite.meal?.name)
    .filter((name): name is string => Boolean(name));
  const skipReasons = source.skips
    .filter((skip) => skip.meal_name)
    .map((skip) => `${skip.meal_name} (${skip.reason ?? "ohne Grund"})`);
  const swapFrequency = new Map<string, number>();
  for (const interaction of source.swaps) {
    const name = interaction.meal?.name;
    if (name) swapFrequency.set(name, (swapFrequency.get(name) ?? 0) + 1);
  }
  const topSwapped = [...swapFrequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([name, count]) => `${name} (${count}×)`);

  const prepHint =
    profile.meal_prep_style === "low_effort"
      ? "Sehr einfache Rezepte (max 15 Min)."
      : profile.meal_prep_style === "meal_prep"
        ? "Meal-Prep-tauglich."
        : profile.meal_prep_style === "2_3_week"
          ? "Hält 2-3 Tage."
          : profile.meal_prep_style === "daily"
            ? "Frisch kochbar."
            : "";
  const weeklyBudget = profile.weekly_budget_eur != null ? Number(profile.weekly_budget_eur) : null;
  const budgetHint =
    profile.budget_band === "<50"
      ? "Günstige Zutaten."
      : profile.budget_band === "50_75"
        ? "Mittleres Budget."
        : profile.budget_band === ">100"
          ? "Großzügiges Budget."
          : "";
  const { isNoCook, equipmentBlock, noCookBlock } = resolveKitchenRestrictions(profile);

  const startMode = opts.start_mode ?? "today";
  const daysToNextShopping = daysUntilNextShopping(profile.shopping_days, now);
  const start = opts.scheduled_start_date
    ? new Date(opts.scheduled_start_date)
    : (() => {
        const date = new Date(now);
        if (startMode === "next_shopping") date.setDate(date.getDate() + daysToNextShopping);
        return date;
      })();
  const planDays =
    opts.plan_days != null ? Math.max(1, Math.min(31, Math.round(opts.plan_days))) : 31;
  const schedule = buildPlanSchedule({
    start,
    planDays,
    trainingWeekdays: Array.isArray(profile.training_weekdays) ? profile.training_weekdays : [],
  });
  const aiSchedule = buildAiSchedule(schedule);
  const aiPlanDays = Math.max(1, aiSchedule.length);
  const trainingCount = schedule.filter((day) => day.type === "training").length;
  const restCount = schedule.length - trainingCount;
  const aiTrainingCount = aiSchedule.filter((day) => day.type === "training").length;
  const aiRestCount = aiSchedule.length - aiTrainingCount;
  const scheduleLines = aiSchedule
    .map(
      (day, index) =>
        `Basis ${index + 1} (${day.wkLabel}): ${day.type === "training" ? "TRAININGSTAG" : "RESTDAY"}`,
    )
    .join("\n");

  const targetsBlock = `Es gibt ZWEI verschiedene Tagesziele — jeder Tag MUSS dem Typ aus dem Tagesplan unten folgen.

📌 GRUNDREGEL Sportwissenschaft (Carb-Cycling):
Trainingstage haben IMMER mehr Kalorien & Kohlenhydrate als Restdays (höherer Glykogen-/Energiebedarf).
Protein bleibt an beiden Tagen ähnlich. Fett darf am Restday leicht höher sein.

TRAININGSTAG-Ziel (für "type":"training", ±5 % treffen):
- kcal: ${trainingTargets.kcal}
- Protein: ${trainingTargets.protein_g} g
- Kohlenhydrate: ${trainingTargets.carbs_g} g
- Fett: ${trainingTargets.fat_g} g

RESTDAY-Ziel (für "type":"rest", ±5 % treffen):
- kcal: ${restTargets.kcal}
- Protein: ${restTargets.protein_g} g
- Kohlenhydrate: ${restTargets.carbs_g} g
- Fett: ${restTargets.fat_g} g

VORGEGEBENER BASIS-TAGESPLAN (wird vom Server auf ${planDays} Tage ausgerollt; Gesamtplan: ${trainingCount}× Training / ${restCount}× Rest, Basis: ${aiTrainingCount}× Training / ${aiRestCount}× Rest):
${scheduleLines}`;

  const goalLabel =
    goalDirection === "cut"
      ? "FETTABBAU (moderates Kaloriendefizit, hohes Protein)"
      : goalDirection === "bulk"
        ? "MUSKELAUFBAU (leichter Kalorienüberschuss, hohes Protein, ausreichend Carbs)"
        : "GEWICHT HALTEN / Recomp";
  const weightDifference =
    currentWeight != null && goalWeight != null ? goalWeight - currentWeight : null;
  const goalBlock = `👤 INDIVIDUELLES KUNDENZIEL — Plan MUSS hierauf abgestimmt sein:
- Ausrichtung: ${goalLabel}
${trainingGoal ? `- Trainingsziel (Kunde): ${TRAINING_GOAL_LABELS[trainingGoal] ?? trainingGoal}` : ""}
${coachingGoal ? `- Coaching-Eigenangabe: "${coachingGoal}"` : ""}
${currentWeight ? `- Aktuelles Gewicht: ${currentWeight} kg (jüngste Messung — Portionen darauf abstimmen)` : "- Aktuelles Gewicht: unbekannt"}
${goalWeight ? `- Wunschgewicht: ${goalWeight} kg${weightDifference !== null ? ` (Differenz: ${weightDifference > 0 ? "+" : ""}${weightDifference.toFixed(1)} kg → ${weightDifference < 0 ? "abnehmen" : weightDifference > 0 ? "zunehmen" : "halten"})` : ""}` : ""}
${height ? `- Größe: ${height} cm` : ""}
${ageYears ? `- Alter: ${ageYears} J.` : ""}
${gender ? `- Geschlecht: ${gender}` : ""}
${activityLevel ? `- Aktivitätslevel: ${activityLevel}` : ""}

Die Kalorien-/Makro-Ziele sind auf aktuelles Gewicht, Wunschgewicht und Trainingsziel kalibriert. Wähle Lebensmittel & Portionsgrößen, die genau dieses Ziel unterstützen: bei Abnehmen sättigend & proteinreich, bei Aufbau energiedicht mit ausreichend Carbs, bei Recomp/Halten ausgewogen.`;

  const wishesBlock = buildWishesBlock(source.wishes);
  const budgetForPeriod =
    weeklyBudget != null && Number.isFinite(weeklyBudget)
      ? Math.round((weeklyBudget * planDays) / 7)
      : null;
  const budgetBlock =
    budgetForPeriod != null
      ? `\n💶 WOCHEN-BUDGET vom Coach: ${weeklyBudget} € / Woche → für diesen ${planDays}-Tage-Plan max. ~${budgetForPeriod} € an Lebensmittelkosten (Discounter-Preise DE). Wähle Zutaten & Mengen so, dass die Gesamteinkaufskosten dieses Budget NICHT überschreiten. Bevorzuge saisonale/günstige Proteinquellen (Hähnchenbrust, Quark, Eier, Hülsenfrüchte, Thunfisch i. W., Hackfleisch), Grundbeilagen (Reis, Haferflocken, Kartoffeln, Nudeln) und tiefgekühltes Gemüse. Premium-Zutaten (Lachs, Rindersteak, Avocado, Nüsse) sparsam einsetzen.`
      : "";
  const foodWhitelistBlock = buildSafeFoodBlock(source.safeFoods);
  const plateauNote = buildPlateauNote(source.weightSeries, now);

  const prompt = `Erstelle eine ${aiPlanDays}-Tage-Basiswoche für einen ${planDays}-Tage-Ernährungsplan. PFLICHT pro Tag: genau 1 Frühstück (slot:"breakfast"), 1 Mittagessen (slot:"lunch"), 1 Abendessen (slot:"dinner") + mindestens 1 Snack (slot:"snack"). Diese 3 Hauptmahlzeiten sind NICHT optional — fehlt eine, ist der Plan ungültig. Der Server wiederholt passende Training-/Restday-Basistage anschließend bis Tag ${planDays}; antworte deshalb NICHT mit ${planDays} Tagen, sondern exakt mit ${aiPlanDays} Basistagen.

🚨 KALORIEN-OBERGRENZE PRO MAHLZEIT: 850 kcal (HART). Keine einzelne Mahlzeit darf 850 kcal überschreiten — auch nicht Frühstück, Mittag oder Abend. Wenn das Tages-kcal-Ziel mit 4 Mahlzeiten nicht erreicht wird, FÜGE WEITERE SNACKS HINZU (Snack 2, Snack 3, …), bis das Tagesziel erreicht ist. Lieber 5–7 kleinere Mahlzeiten als 3–4 zu große. Verteile Kalorien gleichmäßig: typisch Hauptmahlzeiten 500–800 kcal, Snacks 150–400 kcal.

🎯 ZIELWERTE EXAKT TREFFEN: Tages-kcal innerhalb ±3 %, Protein/Kohlenhydrate/Fett jeweils innerhalb ±5 g der Vorgaben. Plane Portionsgrößen mathematisch so, dass die Summe der Mahlzeiten möglichst genau den Tageszielen entspricht — nicht überschreiten, nicht unterschreiten.
${noCookBlock}

${plateauNote ? `\n${plateauNote}\n` : ""}
${goalBlock}

${targetsBlock}


🚨 ABSOLUTE AUSSCHLÜSSE — niemals verwenden (Kategorien gelten für ALLE Varianten, inkl. geräuchert/getrocknet/eingelegt/pulver/-mehl/-milch):
${allergyList.length ? `ALLERGIEN: ${allergyList.join(", ")}${expandedAllergies.length > allergyList.length ? ` — gilt auch für: ${expandedAllergies.filter((term) => !allergyList.map((allergy) => allergy.toLowerCase()).includes(term)).join(", ")}` : ""}` : "(keine)"}
${nogoList.length ? `NO-GO: ${nogoList.join(", ")}${expandedNogo.length > nogoList.length ? ` — gilt auch für: ${expandedNogo.filter((term) => !nogoList.map((nogo) => nogo.toLowerCase()).includes(term)).join(", ")}` : ""}` : "(keine)"}
${profile.diet_style ? `ERNÄHRUNGSFORM (HART): ${profile.diet_style}${profile.diet_style === "vegan" ? " — KEINE tierischen Produkte (kein Fleisch, Fisch, Ei, Milch, Käse, Quark, Skyr, Joghurt, Butter, Honig)." : profile.diet_style === "vegetarian" ? " — KEIN Fleisch, KEIN Fisch/Meeresfrüchte. Milchprodukte und Eier erlaubt." : profile.diet_style === "pescetarian" ? " — KEIN Fleisch (Rind/Schwein/Geflügel/Lamm/Wild). Fisch, Meeresfrüchte, Milch, Eier erlaubt." : profile.diet_style === "flexitarian" ? " — überwiegend pflanzlich, Fleisch/Fisch nur sparsam." : ""}` : ""}
${profile.diet_notes ? `ERNÄHRUNGS-DETAILS: ${profile.diet_notes}` : ""}


KUNDEN-VORLIEBEN (priorisieren):
${favoriteFoods.length ? `Lieblings-Foods: ${favoriteFoods.join(", ")}` : ""}
${favoriteNames.length ? `Favorisierte Rezepte: ${favoriteNames.slice(0, 10).join(", ")}` : ""}
${liked.length ? `Mag (4-5★): ${liked.slice(0, 10).join(", ")}` : ""}
${disliked.length ? `Mag NICHT — vermeiden: ${disliked.slice(0, 10).join(", ")}` : ""}
${topSwapped.length ? `Häufig getauscht (lieber meiden): ${topSwapped.join(", ")}` : ""}
${skipReasons.length ? `Häufig übersprungen: ${skipReasons.slice(0, 8).join("; ")}` : ""}
${wishesBlock}${budgetBlock}${equipmentBlock}${foodWhitelistBlock}
${prepHint} ${budgetHint}



Antworte AUSSCHLIESSLICH mit gültigem JSON in folgender Form:
{"days":[{"name":"Tag 1","type":"training","meals":[{"slot":"breakfast","name":"Overnight Oats","description":"80g Haferflocken, 250ml Milch 1,5%, 150g Skyr natur, 100g Beeren gemischt, 15g Chia-Samen, 15g Mandeln","ingredients":[{"food_id":"haferflocken","name":"Haferflocken","amount":80,"unit":"g"},{"food_id":"milch_1_5","name":"Milch 1,5%","amount":250,"unit":"ml","grams":250},{"food_id":"skyr_natur","name":"Skyr natur","amount":150,"unit":"g"},{"food_id":"beeren_gemischt","name":"Beeren gemischt","amount":100,"unit":"g"},{"food_id":"chia_samen","name":"Chia-Samen","amount":15,"unit":"g"},{"food_id":"mandeln","name":"Mandeln","amount":15,"unit":"g"}],"kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}]}]}

🧮 STRUKTURIERTE ZUTATEN SIND PFLICHT — die Berechnung läuft ausschließlich über food_id + Gramm:
- Jede Mahlzeit MUSS ein "ingredients"-Array enthalten, mit JEDER einzelnen Zutat aus der Description.
- Jede Zutat MUSS ein Feld "food_id" haben — der Wert ist eine text_id aus dem GESCHLOSSENEN LEBENSMITTEL-KATALOG oben. Keine Ausnahme.
- Zusätzlich: "name" (Anzeige-Name, darf der kanonische Name sein), "amount" (Zahl) und "unit" (g, ml, EL, TL, Stück). Bei Stück/Scheibe/EL/TL MUSS zusätzlich "grams" mit dem Gesamtgewicht angegeben werden.
- "amount" + "unit" müssen genau zur Mengenangabe im Description-Text passen.
- Nährwerte ("kcal","protein_g","carbs_g","fat_g") IMMER auf 0 setzen — der Server berechnet sie deterministisch aus food_id + Gramm. Schätze NIEMALS selbst.
- Wasser, Gewürze, Salz, Pfeffer, Zimt: in "ingredients" mit amount:0 oder unit:"prise" angeben (zählen nicht in die Makros). food_id ist trotzdem Pflicht, sofern im Katalog vorhanden — sonst weglassen.

❌ Wenn du eine Zutat verwendest, deren food_id NICHT im Katalog steht, wird die gesamte Mahlzeit verworfen und ggf. der Plan zur Coach-Prüfung markiert.

Genau ${aiPlanDays} Basistage in der vorgegebenen Reihenfolge, mindestens 4 Mahlzeiten pro Tag (Frühstück, Mittag, Abend, Snack), bei Bedarf zusätzliche Snacks ergänzen. KEINE Mahlzeit über 850 kcal. Jeder Tag MUSS ein Feld "type" mit "training" ODER "rest" enthalten (passend zum Basis-Tagesplan oben). Tagessummen müssen die jeweiligen Ziele treffen.

WICHTIG zu name/description:
- "name" = konkreter Gerichtsname (z. B. Overnight Oats, Hähnchen-Reis-Bowl).
- "description" = NUR kommagetrennte Zutaten mit Mengen für die Anzeige (z. B. 80g Haferflocken, 250ml Milch). NIEMALS Zubereitungsanweisungen.
- JEDE Zutat MUSS eine konkrete Menge in g, ml, Stück oder EL/TL haben — NIEMALS "Portion", "etwas", "nach Geschmack" o. ä. Auch Salat, Gemüse, Beilagen und Toppings IMMER in Gramm angeben (z. B. "150g Blattsalat", "200g Brokkoli", "30g Feldsalat").`;

  return {
    start,
    planDays,
    schedule,
    aiSchedule,
    aiPlanDays,
    trainingTargets,
    restTargets,
    forbidden,
    isNoCook,
    prompt,
    wishesData: source.wishes.filter((wish) => Boolean(wish.id && wish.wish)),
  };
}
