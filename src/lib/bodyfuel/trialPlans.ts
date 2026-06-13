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
          { name: "Frühstück", description: "Haferflocken (80g) mit Magerquark (250g), Beeren & 1 EL Honig", kcal: 520, protein_g: 38, carbs_g: 70, fat_g: 8 },
          { name: "Snack", description: "Banane + 30g Whey-Shake", kcal: 220, protein_g: 26, carbs_g: 25, fat_g: 2 },
          { name: "Mittagessen", description: "Hähnchenbrust (180g), Reis (80g roh), Brokkoli", kcal: 620, protein_g: 55, carbs_g: 70, fat_g: 8 },
          { name: "Pre-Workout", description: "Reiswaffeln (3 St.) + 1 EL Erdnussmus", kcal: 230, protein_g: 6, carbs_g: 30, fat_g: 9 },
          { name: "Abendessen", description: "Lachs (180g), Süßkartoffel (250g), Salat", kcal: 700, protein_g: 42, carbs_g: 55, fat_g: 28 },
          { name: "Late-Night", description: "Magerquark (200g) mit Zimt", kcal: 150, protein_g: 24, carbs_g: 8, fat_g: 0 },
        ],
      },
      {
        id: "v2",
        label: "Variante B — Vielfalt",
        meals: [
          { name: "Frühstück", description: "Rührei aus 3 Eiern + 50g Haferflocken + Apfel", kcal: 540, protein_g: 30, carbs_g: 55, fat_g: 18 },
          { name: "Snack", description: "Skyr (200g) + 25g Mandeln", kcal: 280, protein_g: 24, carbs_g: 12, fat_g: 14 },
          { name: "Mittagessen", description: "Rinderhack (150g), Vollkornnudeln (80g), Tomatensauce", kcal: 620, protein_g: 45, carbs_g: 75, fat_g: 12 },
          { name: "Pre-Workout", description: "Toast (2 Scheiben) + Honig", kcal: 200, protein_g: 6, carbs_g: 38, fat_g: 2 },
          { name: "Abendessen", description: "Pute (180g), Couscous (80g), Zucchini-Pfanne", kcal: 600, protein_g: 50, carbs_g: 60, fat_g: 8 },
          { name: "Late-Night", description: "Hüttenkäse (200g) + Gurke", kcal: 160, protein_g: 25, carbs_g: 4, fat_g: 4 },
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
          { name: "Frühstück", description: "Rührei aus 3 Eiern + Avocado (1/2)", kcal: 420, protein_g: 24, carbs_g: 6, fat_g: 32 },
          { name: "Snack", description: "Skyr (200g) + Beeren", kcal: 180, protein_g: 24, carbs_g: 14, fat_g: 1 },
          { name: "Mittagessen", description: "Hähnchen (180g), gemischter Salat, Olivenöl", kcal: 480, protein_g: 50, carbs_g: 10, fat_g: 24 },
          { name: "Abendessen", description: "Lachs (150g), grüne Bohnen, Butter", kcal: 520, protein_g: 35, carbs_g: 8, fat_g: 36 },
          { name: "Late-Night", description: "Magerquark (250g) + Nüsse (15g)", kcal: 280, protein_g: 32, carbs_g: 6, fat_g: 13 },
        ],
      },
      {
        id: "v2",
        label: "Variante B — Ausgewogen",
        meals: [
          { name: "Frühstück", description: "Skyr (250g) + 40g Haferflocken + Beeren", kcal: 380, protein_g: 32, carbs_g: 45, fat_g: 4 },
          { name: "Snack", description: "Apfel + 20g Mandeln", kcal: 200, protein_g: 4, carbs_g: 22, fat_g: 11 },
          { name: "Mittagessen", description: "Pute (160g), Quinoa (60g roh), Ofengemüse", kcal: 520, protein_g: 45, carbs_g: 50, fat_g: 10 },
          { name: "Abendessen", description: "Lachs (150g), Kartoffeln (200g), Salat", kcal: 580, protein_g: 35, carbs_g: 40, fat_g: 25 },
          { name: "Late-Night", description: "Magerquark (200g) + Zimt", kcal: 150, protein_g: 24, carbs_g: 8, fat_g: 0 },
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
      { name: "Bankdrücken (Langhantel)", sets: 4, reps: "8-10", notes: "Hauptübung, kontrollierte Ausführung" },
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
      { name: "Kniebeugen (Langhantel)", sets: 4, reps: "8-10", notes: "Tief beugen, Rücken gerade" },
      { name: "Rumänisches Kreuzheben", sets: 3, reps: "10" },
      { name: "Beinpresse", sets: 3, reps: "12-15" },
      { name: "Ausfallschritte (Kurzhanteln)", sets: 3, reps: "10 pro Bein" },
      { name: "Wadenheben", sets: 4, reps: "15" },
      { name: "Plank", sets: 3, reps: "45-60 Sek." },
    ],
  },
];
