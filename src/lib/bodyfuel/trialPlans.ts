// Statische Starterpläne für den 7-Tage-Trial.
// Werden direkt im Frontend gerendert – keine DB-Einträge nötig.

export type TrialMeal = {
  name: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type TrialNutritionDay = {
  id: string;
  name: string; // z.B. "Trainingstag", "Restday"
  kind: "training" | "rest";
  variants: { id: string; label: string; meals: TrialMeal[] }[];
};

export const TRIAL_NUTRITION: TrialNutritionDay[] = [
  {
    id: "training",
    name: "Trainingstag (2400 kcal)",
    kind: "training",
    variants: [
      {
        id: "v1",
        label: "Variante A — Klassisch",
        meals: [
          {
            name: "Frühstück",
            description: "80g Haferflocken, 250g Magerquark, 100g Beeren, 20g Honig",
            kcal: 520,
            protein_g: 38,
            carbs_g: 70,
            fat_g: 8,
          },
          {
            name: "Snack",
            description: "120g Banane, 30g Whey-Pulver",
            kcal: 220,
            protein_g: 26,
            carbs_g: 25,
            fat_g: 2,
          },
          {
            name: "Mittagessen",
            description: "180g Hähnchenbrust, 80g Reis roh, 200g Brokkoli",
            kcal: 620,
            protein_g: 55,
            carbs_g: 70,
            fat_g: 8,
          },
          {
            name: "Pre-Workout",
            description: "24g Reiswaffeln, 20g Erdnussmus",
            kcal: 230,
            protein_g: 6,
            carbs_g: 30,
            fat_g: 9,
          },
          {
            name: "Abendessen",
            description: "180g Lachs, 250g Süßkartoffel, 150g Salat",
            kcal: 700,
            protein_g: 42,
            carbs_g: 55,
            fat_g: 28,
          },
          {
            name: "Late-Night",
            description: "200g Magerquark, 2g Zimt",
            kcal: 150,
            protein_g: 24,
            carbs_g: 8,
            fat_g: 0,
          },
        ],
      },
      {
        id: "v2",
        label: "Variante B — Vielfalt",
        meals: [
          {
            name: "Frühstück",
            description: "180g Hühnerei, 50g Haferflocken, 150g Apfel",
            kcal: 540,
            protein_g: 30,
            carbs_g: 55,
            fat_g: 18,
          },
          {
            name: "Snack",
            description: "200g Skyr, 25g Mandeln",
            kcal: 280,
            protein_g: 24,
            carbs_g: 12,
            fat_g: 14,
          },
          {
            name: "Mittagessen",
            description: "150g Rinderhack, 80g Vollkornnudeln roh, 150g Tomatensauce",
            kcal: 620,
            protein_g: 45,
            carbs_g: 75,
            fat_g: 12,
          },
          {
            name: "Pre-Workout",
            description: "60g Toast, 20g Honig",
            kcal: 200,
            protein_g: 6,
            carbs_g: 38,
            fat_g: 2,
          },
          {
            name: "Abendessen",
            description: "180g Putenbrust, 80g Couscous roh, 200g Zucchini",
            kcal: 600,
            protein_g: 50,
            carbs_g: 60,
            fat_g: 8,
          },
          {
            name: "Late-Night",
            description: "200g Hüttenkäse, 150g Gurke",
            kcal: 160,
            protein_g: 25,
            carbs_g: 4,
            fat_g: 4,
          },
        ],
      },
    ],
  },
  {
    id: "rest",
    name: "Restday (2000 kcal)",
    kind: "rest",
    variants: [
      {
        id: "v1",
        label: "Variante A — Low-Carb",
        meals: [
          {
            name: "Frühstück",
            description: "180g Hühnerei, 85g Avocado",
            kcal: 420,
            protein_g: 24,
            carbs_g: 6,
            fat_g: 32,
          },
          {
            name: "Snack",
            description: "200g Skyr, 100g Beeren",
            kcal: 180,
            protein_g: 24,
            carbs_g: 14,
            fat_g: 1,
          },
          {
            name: "Mittagessen",
            description: "180g Hähnchenbrust, 200g gemischter Salat, 20ml Olivenöl",
            kcal: 480,
            protein_g: 50,
            carbs_g: 10,
            fat_g: 24,
          },
          {
            name: "Abendessen",
            description: "150g Lachs, 200g grüne Bohnen, 20g Butter",
            kcal: 520,
            protein_g: 35,
            carbs_g: 8,
            fat_g: 36,
          },
          {
            name: "Late-Night",
            description: "250g Magerquark, 15g Nüsse",
            kcal: 280,
            protein_g: 32,
            carbs_g: 6,
            fat_g: 13,
          },
        ],
      },
      {
        id: "v2",
        label: "Variante B — Ausgewogen",
        meals: [
          {
            name: "Frühstück",
            description: "250g Skyr, 40g Haferflocken, 100g Beeren",
            kcal: 380,
            protein_g: 32,
            carbs_g: 45,
            fat_g: 4,
          },
          {
            name: "Snack",
            description: "150g Apfel, 20g Mandeln",
            kcal: 200,
            protein_g: 4,
            carbs_g: 22,
            fat_g: 11,
          },
          {
            name: "Mittagessen",
            description: "160g Putenbrust, 60g Quinoa roh, 200g Ofengemüse",
            kcal: 520,
            protein_g: 45,
            carbs_g: 50,
            fat_g: 10,
          },
          {
            name: "Abendessen",
            description: "150g Lachs, 200g Kartoffeln, 150g Salat",
            kcal: 580,
            protein_g: 35,
            carbs_g: 40,
            fat_g: 25,
          },
          {
            name: "Late-Night",
            description: "200g Magerquark, 2g Zimt",
            kcal: 150,
            protein_g: 24,
            carbs_g: 8,
            fat_g: 0,
          },
        ],
      },
    ],
  },
];

export type TrialExercise = {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
};

export type TrialTrainingDay = {
  id: string;
  name: string;
  focus: string;
  exercises: TrialExercise[];
};

export const TRIAL_TRAINING: TrialTrainingDay[] = [
  {
    id: "A",
    name: "Tag A — Push",
    focus: "Brust, Schulter, Trizeps",
    exercises: [
      {
        name: "Bankdrücken (Langhantel)",
        sets: 4,
        reps: "8-10",
        notes: "Hauptübung, kontrollierte Ausführung",
      },
      { name: "Schrägbankdrücken (Kurzhanteln)", sets: 3, reps: "10-12" },
      { name: "Schulterdrücken (Kurzhanteln)", sets: 3, reps: "10-12" },
      { name: "Seitheben", sets: 3, reps: "12-15" },
      { name: "Trizepsdrücken am Kabel", sets: 3, reps: "12-15" },
      { name: "Liegestütze (Cooldown)", sets: 2, reps: "AMRAP" },
    ],
  },
  {
    id: "B",
    name: "Tag B — Pull",
    focus: "Rücken, Bizeps",
    exercises: [
      { name: "Klimmzüge (oder Latzug)", sets: 4, reps: "6-10" },
      { name: "Rudern vorgebeugt (Langhantel)", sets: 4, reps: "8-10" },
      { name: "Latzug eng", sets: 3, reps: "10-12" },
      { name: "Face Pulls", sets: 3, reps: "15" },
      { name: "Bizeps-Curls (Langhantel)", sets: 3, reps: "10-12" },
      { name: "Hammer-Curls", sets: 2, reps: "12" },
    ],
  },
  {
    id: "C",
    name: "Tag C — Legs",
    focus: "Beine, Core",
    exercises: [
      {
        name: "Kniebeugen (Langhantel)",
        sets: 4,
        reps: "8-10",
        notes: "Tief beugen, Rücken gerade",
      },
      { name: "Rumänisches Kreuzheben", sets: 3, reps: "10" },
      { name: "Beinpresse", sets: 3, reps: "12-15" },
      { name: "Ausfallschritte (Kurzhanteln)", sets: 3, reps: "10 pro Bein" },
      { name: "Wadenheben", sets: 4, reps: "15" },
      { name: "Plank", sets: 3, reps: "45-60 Sek." },
    ],
  },
];
