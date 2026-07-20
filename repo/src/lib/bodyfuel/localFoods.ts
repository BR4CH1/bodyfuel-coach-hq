import type { FoodResult } from "@/lib/nutrition.functions";

export type LocalFood = FoodResult & { aliases?: string[] };

/**
 * Lokale Grunddatenbank für Basis-Lebensmittel, die in der Open-Food-Facts-Suche
 * oft schlecht/garnicht auffindbar sind (z.B. "Ei", "Apfel", "Banane").
 * Werte pro 100 g, soweit nicht anders angegeben.
 */
export const LOCAL_FOODS: LocalFood[] = [
  { name: "Ei (ganz, roh/gekocht)", brand: null, barcode: null, kcal_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1.1, fat_per_100g: 11, serving_g: 58, serving_label: "1 Stück ≈ 58 g (M)", aliases: ["ei", "eier", "hühnerei", "spiegelei", "rührei"] },
  { name: "Eiweiß (Eiklar)", brand: null, barcode: null, kcal_per_100g: 52, protein_per_100g: 11, carbs_per_100g: 0.7, fat_per_100g: 0.2, serving_g: 33, serving_label: "1 Stück ≈ 33 g", aliases: ["eiklar", "eiweiß"] },
  { name: "Eigelb", brand: null, barcode: null, kcal_per_100g: 322, protein_per_100g: 16, carbs_per_100g: 3.6, fat_per_100g: 27, serving_g: 18, serving_label: "1 Stück ≈ 18 g", aliases: ["dotter", "eigelb"] },

  { name: "Apfel", brand: null, barcode: null, kcal_per_100g: 52, protein_per_100g: 0.3, carbs_per_100g: 14, fat_per_100g: 0.2, serving_g: 180, serving_label: "1 Stück ≈ 180 g", aliases: ["apfel", "äpfel"] },
  { name: "Banane", brand: null, barcode: null, kcal_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 23, fat_per_100g: 0.3, serving_g: 120, serving_label: "1 Stück ≈ 120 g", aliases: ["banane", "bananen"] },
  { name: "Birne", brand: null, barcode: null, kcal_per_100g: 57, protein_per_100g: 0.4, carbs_per_100g: 15, fat_per_100g: 0.1, serving_g: 170, serving_label: "1 Stück ≈ 170 g", aliases: ["birne"] },
  { name: "Orange", brand: null, barcode: null, kcal_per_100g: 47, protein_per_100g: 0.9, carbs_per_100g: 12, fat_per_100g: 0.1, serving_g: 140, serving_label: "1 Stück ≈ 140 g", aliases: ["orange", "apfelsine"] },
  { name: "Erdbeeren", brand: null, barcode: null, kcal_per_100g: 32, protein_per_100g: 0.7, carbs_per_100g: 7.7, fat_per_100g: 0.3, serving_g: null, serving_label: null, aliases: ["erdbeere", "erdbeeren"] },
  { name: "Heidelbeeren", brand: null, barcode: null, kcal_per_100g: 57, protein_per_100g: 0.7, carbs_per_100g: 14, fat_per_100g: 0.3, serving_g: null, serving_label: null, aliases: ["blaubeeren", "heidelbeeren"] },
  { name: "Himbeeren", brand: null, barcode: null, kcal_per_100g: 43, protein_per_100g: 1.2, carbs_per_100g: 5.4, fat_per_100g: 0.3, serving_g: null, serving_label: null, aliases: ["himbeere", "himbeeren", "raspberry", "raspberries"] },
  { name: "Brombeeren", brand: null, barcode: null, kcal_per_100g: 43, protein_per_100g: 1.4, carbs_per_100g: 6.2, fat_per_100g: 0.5, serving_g: null, serving_label: null, aliases: ["brombeere", "brombeeren", "blackberry", "blackberries"] },
  { name: "Avocado", brand: null, barcode: null, kcal_per_100g: 160, protein_per_100g: 2, carbs_per_100g: 9, fat_per_100g: 15, serving_g: 150, serving_label: "1/2 Stück ≈ 150 g", aliases: ["avocado"] },

  { name: "Haferflocken", brand: null, barcode: null, kcal_per_100g: 372, protein_per_100g: 13.5, carbs_per_100g: 59, fat_per_100g: 7, serving_g: null, serving_label: null, aliases: ["haferflocken", "oats"] },
  { name: "Reis (gekocht)", brand: null, barcode: null, kcal_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3, serving_g: null, serving_label: null, aliases: ["reis"] },
  { name: "Reis (roh)", brand: null, barcode: null, kcal_per_100g: 360, protein_per_100g: 7, carbs_per_100g: 78, fat_per_100g: 1, serving_g: null, serving_label: null, aliases: ["reis roh"] },
  { name: "Nudeln (gekocht)", brand: null, barcode: null, kcal_per_100g: 158, protein_per_100g: 5.8, carbs_per_100g: 31, fat_per_100g: 0.9, serving_g: null, serving_label: null, aliases: ["nudeln", "pasta", "spaghetti"] },
  { name: "Nudeln (roh)", brand: null, barcode: null, kcal_per_100g: 371, protein_per_100g: 13, carbs_per_100g: 75, fat_per_100g: 1.5, serving_g: null, serving_label: null, aliases: ["nudeln roh", "pasta roh"] },
  { name: "Kartoffel (gekocht)", brand: null, barcode: null, kcal_per_100g: 77, protein_per_100g: 2, carbs_per_100g: 17, fat_per_100g: 0.1, serving_g: 150, serving_label: "1 Stück ≈ 150 g", aliases: ["kartoffel", "kartoffeln"] },
  { name: "Süßkartoffel (gekocht)", brand: null, barcode: null, kcal_per_100g: 86, protein_per_100g: 1.6, carbs_per_100g: 20, fat_per_100g: 0.1, serving_g: null, serving_label: null, aliases: ["süßkartoffel"] },
  { name: "Brot (Vollkorn)", brand: null, barcode: null, kcal_per_100g: 247, protein_per_100g: 9, carbs_per_100g: 41, fat_per_100g: 3.4, serving_g: 50, serving_label: "1 Scheibe ≈ 50 g", aliases: ["brot", "vollkornbrot"] },
  { name: "Toastbrot", brand: null, barcode: null, kcal_per_100g: 275, protein_per_100g: 9, carbs_per_100g: 49, fat_per_100g: 4, serving_g: 25, serving_label: "1 Scheibe ≈ 25 g", aliases: ["toast", "toastbrot"] },
  { name: "Brötchen (Weizen)", brand: null, barcode: null, kcal_per_100g: 264, protein_per_100g: 8.5, carbs_per_100g: 51, fat_per_100g: 2.5, serving_g: 60, serving_label: "1 Stück ≈ 60 g", aliases: ["brötchen", "semmel"] },

  { name: "Hähnchenbrust (roh)", brand: null, barcode: null, kcal_per_100g: 110, protein_per_100g: 23, carbs_per_100g: 0, fat_per_100g: 1.5, serving_g: null, serving_label: null, aliases: ["hähnchen", "hähnchenbrust", "huhn", "chicken"] },
  { name: "Putenbrust (roh)", brand: null, barcode: null, kcal_per_100g: 105, protein_per_100g: 22, carbs_per_100g: 0, fat_per_100g: 1.4, serving_g: null, serving_label: null, aliases: ["pute", "putenbrust"] },
  { name: "Rinderhack (mager)", brand: null, barcode: null, kcal_per_100g: 137, protein_per_100g: 21, carbs_per_100g: 0, fat_per_100g: 6, serving_g: null, serving_label: null, aliases: ["hackfleisch", "rinderhack", "hack"] },
  { name: "Rindersteak (Filet)", brand: null, barcode: null, kcal_per_100g: 158, protein_per_100g: 22, carbs_per_100g: 0, fat_per_100g: 7.5, serving_g: null, serving_label: null, aliases: ["rind", "steak", "rindfleisch", "filet"] },
  { name: "Lachs (roh)", brand: null, barcode: null, kcal_per_100g: 208, protein_per_100g: 20, carbs_per_100g: 0, fat_per_100g: 13, serving_g: null, serving_label: null, aliases: ["lachs", "salmon"] },
  { name: "Thunfisch (in Wasser)", brand: null, barcode: null, kcal_per_100g: 108, protein_per_100g: 24, carbs_per_100g: 0, fat_per_100g: 1, serving_g: null, serving_label: null, aliases: ["thunfisch", "tuna"] },

  { name: "Magerquark", brand: null, barcode: null, kcal_per_100g: 67, protein_per_100g: 12, carbs_per_100g: 4, fat_per_100g: 0.3, serving_g: null, serving_label: null, aliases: ["magerquark", "quark"] },
  { name: "Skyr (natur)", brand: null, barcode: null, kcal_per_100g: 63, protein_per_100g: 11, carbs_per_100g: 4, fat_per_100g: 0.2, serving_g: null, serving_label: null, aliases: ["skyr"] },
  { name: "Naturjoghurt 1,5%", brand: null, barcode: null, kcal_per_100g: 47, protein_per_100g: 4.8, carbs_per_100g: 5.7, fat_per_100g: 1.5, serving_g: null, serving_label: null, aliases: ["joghurt", "naturjoghurt"] },
  { name: "Hüttenkäse", brand: null, barcode: null, kcal_per_100g: 98, protein_per_100g: 12, carbs_per_100g: 3.4, fat_per_100g: 4.3, serving_g: null, serving_label: null, aliases: ["hüttenkäse", "cottage cheese"] },
  { name: "Milch 1,5%", brand: null, barcode: null, kcal_per_100g: 47, protein_per_100g: 3.4, carbs_per_100g: 4.9, fat_per_100g: 1.5, serving_g: null, serving_label: null, aliases: ["milch"] },
  { name: "Gouda", brand: null, barcode: null, kcal_per_100g: 356, protein_per_100g: 25, carbs_per_100g: 2.2, fat_per_100g: 27, serving_g: 30, serving_label: "1 Scheibe ≈ 30 g", aliases: ["käse", "gouda"] },

  { name: "Olivenöl", brand: null, barcode: null, kcal_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100, serving_g: null, serving_label: null, aliases: ["olivenöl", "öl"] },
  { name: "Butter", brand: null, barcode: null, kcal_per_100g: 717, protein_per_100g: 0.9, carbs_per_100g: 0.7, fat_per_100g: 81, serving_g: null, serving_label: null, aliases: ["butter"] },
  { name: "Mandeln", brand: null, barcode: null, kcal_per_100g: 579, protein_per_100g: 21, carbs_per_100g: 22, fat_per_100g: 50, serving_g: null, serving_label: null, aliases: ["mandeln"] },
  { name: "Walnüsse", brand: null, barcode: null, kcal_per_100g: 654, protein_per_100g: 15, carbs_per_100g: 14, fat_per_100g: 65, serving_g: null, serving_label: null, aliases: ["walnüsse", "nüsse"] },
  { name: "Erdnussbutter", brand: null, barcode: null, kcal_per_100g: 588, protein_per_100g: 25, carbs_per_100g: 20, fat_per_100g: 50, serving_g: null, serving_label: null, aliases: ["erdnussbutter", "peanut butter"] },

  { name: "Brokkoli", brand: null, barcode: null, kcal_per_100g: 34, protein_per_100g: 2.8, carbs_per_100g: 7, fat_per_100g: 0.4, serving_g: null, serving_label: null, aliases: ["brokkoli", "broccoli"] },
  { name: "Möhre/Karotte", brand: null, barcode: null, kcal_per_100g: 41, protein_per_100g: 0.9, carbs_per_100g: 10, fat_per_100g: 0.2, serving_g: 80, serving_label: "1 Stück ≈ 80 g", aliases: ["möhre", "karotte", "möhren", "karotten"] },
  { name: "Tomate", brand: null, barcode: null, kcal_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2, serving_g: 100, serving_label: "1 Stück ≈ 100 g", aliases: ["tomate", "tomaten"] },
  { name: "Gurke", brand: null, barcode: null, kcal_per_100g: 16, protein_per_100g: 0.7, carbs_per_100g: 3.6, fat_per_100g: 0.1, serving_g: null, serving_label: null, aliases: ["gurke"] },
  { name: "Paprika", brand: null, barcode: null, kcal_per_100g: 31, protein_per_100g: 1, carbs_per_100g: 6, fat_per_100g: 0.3, serving_g: 150, serving_label: "1 Stück ≈ 150 g", aliases: ["paprika"] },
  { name: "Spinat", brand: null, barcode: null, kcal_per_100g: 23, protein_per_100g: 2.9, carbs_per_100g: 3.6, fat_per_100g: 0.4, serving_g: null, serving_label: null, aliases: ["spinat"] },
  { name: "Zwiebel", brand: null, barcode: null, kcal_per_100g: 40, protein_per_100g: 1.1, carbs_per_100g: 9, fat_per_100g: 0.1, serving_g: null, serving_label: null, aliases: ["zwiebel"] },
  { name: "Linsen (gekocht)", brand: null, barcode: null, kcal_per_100g: 116, protein_per_100g: 9, carbs_per_100g: 20, fat_per_100g: 0.4, serving_g: null, serving_label: null, aliases: ["linsen"] },
  { name: "Kichererbsen (gekocht)", brand: null, barcode: null, kcal_per_100g: 164, protein_per_100g: 8.9, carbs_per_100g: 27, fat_per_100g: 2.6, serving_g: null, serving_label: null, aliases: ["kichererbsen"] },

  { name: "Zucker", brand: null, barcode: null, kcal_per_100g: 387, protein_per_100g: 0, carbs_per_100g: 100, fat_per_100g: 0, serving_g: null, serving_label: null, aliases: ["zucker"] },
  { name: "Honig", brand: null, barcode: null, kcal_per_100g: 304, protein_per_100g: 0.3, carbs_per_100g: 82, fat_per_100g: 0, serving_g: null, serving_label: null, aliases: ["honig"] },

  // Bäckerei / SB-Theke (Aldi, Lidl, etc.)
  { name: "Käse-Laugenstange (Aldi SB-Theke)", brand: "Aldi", barcode: null, kcal_per_100g: 320, protein_per_100g: 12, carbs_per_100g: 38, fat_per_100g: 13, serving_g: 90, serving_label: "1 Stück ≈ 90 g", aliases: ["käselaugenstange", "käse laugenstange", "käse-laugenstange", "laugenstange käse", "aldi käselaugenstange"] },
  { name: "Laugenstange (natur)", brand: null, barcode: null, kcal_per_100g: 270, protein_per_100g: 9, carbs_per_100g: 50, fat_per_100g: 3.5, serving_g: 80, serving_label: "1 Stück ≈ 80 g", aliases: ["laugenstange", "laugenstangen"] },
  { name: "Laugenbrezel", brand: null, barcode: null, kcal_per_100g: 280, protein_per_100g: 9, carbs_per_100g: 53, fat_per_100g: 3, serving_g: 80, serving_label: "1 Stück ≈ 80 g", aliases: ["brezel", "brezn", "laugenbrezel"] },
  { name: "Croissant (Butter)", brand: null, barcode: null, kcal_per_100g: 406, protein_per_100g: 8, carbs_per_100g: 42, fat_per_100g: 22, serving_g: 60, serving_label: "1 Stück ≈ 60 g", aliases: ["croissant", "hörnchen"] },
  { name: "Schoko-Croissant", brand: null, barcode: null, kcal_per_100g: 430, protein_per_100g: 7, carbs_per_100g: 47, fat_per_100g: 23, serving_g: 75, serving_label: "1 Stück ≈ 75 g", aliases: ["schokocroissant", "schoko croissant", "pain au chocolat"] },
  { name: "Franzbrötchen", brand: null, barcode: null, kcal_per_100g: 410, protein_per_100g: 6, carbs_per_100g: 50, fat_per_100g: 20, serving_g: 85, serving_label: "1 Stück ≈ 85 g", aliases: ["franzbrötchen"] },
  { name: "Berliner / Krapfen", brand: null, barcode: null, kcal_per_100g: 360, protein_per_100g: 6, carbs_per_100g: 47, fat_per_100g: 16, serving_g: 75, serving_label: "1 Stück ≈ 75 g", aliases: ["berliner", "krapfen", "pfannkuchen"] },
  { name: "Käsebrötchen (überbacken)", brand: null, barcode: null, kcal_per_100g: 310, protein_per_100g: 13, carbs_per_100g: 38, fat_per_100g: 11, serving_g: 90, serving_label: "1 Stück ≈ 90 g", aliases: ["käsebrötchen", "käse brötchen"] },
  { name: "Mohnbrötchen", brand: null, barcode: null, kcal_per_100g: 280, protein_per_100g: 9, carbs_per_100g: 52, fat_per_100g: 3.5, serving_g: 60, serving_label: "1 Stück ≈ 60 g", aliases: ["mohnbrötchen"] },
  { name: "Sesambrötchen", brand: null, barcode: null, kcal_per_100g: 285, protein_per_100g: 9, carbs_per_100g: 51, fat_per_100g: 4, serving_g: 60, serving_label: "1 Stück ≈ 60 g", aliases: ["sesambrötchen"] },
  { name: "Roggenbrötchen", brand: null, barcode: null, kcal_per_100g: 255, protein_per_100g: 8, carbs_per_100g: 50, fat_per_100g: 1.5, serving_g: 60, serving_label: "1 Stück ≈ 60 g", aliases: ["roggenbrötchen"] },
  { name: "Körnerbrötchen", brand: null, barcode: null, kcal_per_100g: 290, protein_per_100g: 10, carbs_per_100g: 45, fat_per_100g: 6, serving_g: 75, serving_label: "1 Stück ≈ 75 g", aliases: ["körnerbrötchen", "mehrkornbrötchen"] },

  // Fast Food / Imbiss / Restaurant
  { name: "Döner Kebab (Kalb, mit Soße)", brand: null, barcode: null, kcal_per_100g: 215, protein_per_100g: 13, carbs_per_100g: 18, fat_per_100g: 10, serving_g: 380, serving_label: "1 Döner ≈ 380 g", aliases: ["döner", "doener", "kebab", "döner kebab", "dönerkebab"] },
  { name: "Dürüm Döner", brand: null, barcode: null, kcal_per_100g: 230, protein_per_100g: 13, carbs_per_100g: 22, fat_per_100g: 10, serving_g: 350, serving_label: "1 Dürüm ≈ 350 g", aliases: ["dürüm", "durum", "yufka"] },
  { name: "Falafel (frittiert)", brand: null, barcode: null, kcal_per_100g: 333, protein_per_100g: 13, carbs_per_100g: 32, fat_per_100g: 17, serving_g: 17, serving_label: "1 Bällchen ≈ 17 g", aliases: ["falafel"] },
  { name: "Currywurst (ohne Pommes)", brand: null, barcode: null, kcal_per_100g: 290, protein_per_100g: 12, carbs_per_100g: 5, fat_per_100g: 25, serving_g: 150, serving_label: "1 Portion ≈ 150 g", aliases: ["currywurst"] },
  { name: "Bratwurst", brand: null, barcode: null, kcal_per_100g: 310, protein_per_100g: 13, carbs_per_100g: 1, fat_per_100g: 28, serving_g: 110, serving_label: "1 Stück ≈ 110 g", aliases: ["bratwurst", "rostbratwurst"] },
  { name: "Wiener Würstchen", brand: null, barcode: null, kcal_per_100g: 270, protein_per_100g: 12, carbs_per_100g: 1, fat_per_100g: 24, serving_g: 50, serving_label: "1 Stück ≈ 50 g", aliases: ["wiener", "würstchen", "frankfurter"] },
  { name: "Pommes Frites (frittiert)", brand: null, barcode: null, kcal_per_100g: 290, protein_per_100g: 3.4, carbs_per_100g: 37, fat_per_100g: 14, serving_g: 150, serving_label: "1 Portion ≈ 150 g", aliases: ["pommes", "fritten", "fries"] },
  { name: "Pizza Salami", brand: null, barcode: null, kcal_per_100g: 265, protein_per_100g: 11, carbs_per_100g: 27, fat_per_100g: 12, serving_g: 320, serving_label: "1 Pizza ≈ 320 g", aliases: ["pizza salami", "salamipizza"] },
  { name: "Pizza Margherita", brand: null, barcode: null, kcal_per_100g: 240, protein_per_100g: 10, carbs_per_100g: 29, fat_per_100g: 9, serving_g: 300, serving_label: "1 Pizza ≈ 300 g", aliases: ["pizza margherita", "margherita"] },
  { name: "Pizza Thunfisch", brand: null, barcode: null, kcal_per_100g: 230, protein_per_100g: 12, carbs_per_100g: 28, fat_per_100g: 7, serving_g: 320, serving_label: "1 Pizza ≈ 320 g", aliases: ["pizza thunfisch", "thunfischpizza", "tonno"] },
  { name: "Schnitzel Wiener Art (paniert)", brand: null, barcode: null, kcal_per_100g: 240, protein_per_100g: 21, carbs_per_100g: 9, fat_per_100g: 14, serving_g: 180, serving_label: "1 Schnitzel ≈ 180 g", aliases: ["schnitzel", "wiener schnitzel", "schweineschnitzel", "putenschnitzel"] },
  { name: "Frikadelle / Bulette", brand: null, barcode: null, kcal_per_100g: 250, protein_per_100g: 16, carbs_per_100g: 6, fat_per_100g: 18, serving_g: 100, serving_label: "1 Stück ≈ 100 g", aliases: ["frikadelle", "bulette", "fleischpflanzerl", "boulette"] },
  { name: "Cevapcici", brand: null, barcode: null, kcal_per_100g: 260, protein_per_100g: 17, carbs_per_100g: 3, fat_per_100g: 20, serving_g: 30, serving_label: "1 Röllchen ≈ 30 g", aliases: ["cevapcici", "cevapi"] },
  { name: "Gyros (gebraten)", brand: null, barcode: null, kcal_per_100g: 220, protein_per_100g: 22, carbs_per_100g: 1, fat_per_100g: 14, serving_g: null, serving_label: null, aliases: ["gyros"] },
  { name: "Burger (Beef, mit Brötchen)", brand: null, barcode: null, kcal_per_100g: 260, protein_per_100g: 15, carbs_per_100g: 20, fat_per_100g: 13, serving_g: 220, serving_label: "1 Burger ≈ 220 g", aliases: ["burger", "hamburger", "cheeseburger", "rindfleischburger"] },
  { name: "Big Mac (McDonald's)", brand: "McDonald's", barcode: null, kcal_per_100g: 250, protein_per_100g: 12, carbs_per_100g: 20, fat_per_100g: 13, serving_g: 220, serving_label: "1 Burger ≈ 220 g", aliases: ["big mac", "bigmac"] },
  { name: "Chicken McNuggets", brand: "McDonald's", barcode: null, kcal_per_100g: 290, protein_per_100g: 15, carbs_per_100g: 18, fat_per_100g: 17, serving_g: 17, serving_label: "1 Stück ≈ 17 g", aliases: ["nuggets", "chicken nuggets", "mcnuggets"] },
  { name: "Sushi (Maki, gemischt)", brand: null, barcode: null, kcal_per_100g: 150, protein_per_100g: 5, carbs_per_100g: 27, fat_per_100g: 2, serving_g: 20, serving_label: "1 Stück ≈ 20 g", aliases: ["sushi", "maki", "nigiri"] },
  { name: "Asia Nudeln mit Hähnchen", brand: null, barcode: null, kcal_per_100g: 165, protein_per_100g: 9, carbs_per_100g: 20, fat_per_100g: 5, serving_g: 400, serving_label: "1 Portion ≈ 400 g", aliases: ["asia nudeln", "wok nudeln", "chow mein", "bami goreng"] },
  { name: "Pad Thai", brand: null, barcode: null, kcal_per_100g: 195, protein_per_100g: 8, carbs_per_100g: 28, fat_per_100g: 6, serving_g: 400, serving_label: "1 Portion ≈ 400 g", aliases: ["pad thai"] },
  { name: "Lasagne (Bolognese)", brand: null, barcode: null, kcal_per_100g: 150, protein_per_100g: 8, carbs_per_100g: 12, fat_per_100g: 7, serving_g: 400, serving_label: "1 Portion ≈ 400 g", aliases: ["lasagne", "lasagna"] },
  { name: "Spaghetti Bolognese (gekocht)", brand: null, barcode: null, kcal_per_100g: 140, protein_per_100g: 7, carbs_per_100g: 18, fat_per_100g: 4, serving_g: 400, serving_label: "1 Portion ≈ 400 g", aliases: ["spaghetti bolognese", "bolognese", "bolo"] },
  { name: "Spaghetti Carbonara (gekocht)", brand: null, barcode: null, kcal_per_100g: 195, protein_per_100g: 8, carbs_per_100g: 22, fat_per_100g: 8, serving_g: 350, serving_label: "1 Portion ≈ 350 g", aliases: ["carbonara", "spaghetti carbonara"] },
  { name: "Caesar Salat (mit Hähnchen)", brand: null, barcode: null, kcal_per_100g: 145, protein_per_100g: 10, carbs_per_100g: 5, fat_per_100g: 10, serving_g: 350, serving_label: "1 Portion ≈ 350 g", aliases: ["caesar salat", "caesar salad"] },

  // Süßes & Snacks
  { name: "Schokoriegel (Snickers-Typ)", brand: null, barcode: null, kcal_per_100g: 488, protein_per_100g: 8, carbs_per_100g: 60, fat_per_100g: 24, serving_g: 50, serving_label: "1 Riegel ≈ 50 g", aliases: ["snickers", "schokoriegel", "mars", "bounty", "twix"] },
  { name: "Milchschokolade", brand: null, barcode: null, kcal_per_100g: 535, protein_per_100g: 7.6, carbs_per_100g: 58, fat_per_100g: 30, serving_g: null, serving_label: null, aliases: ["schokolade", "milka", "vollmilchschokolade"] },
  { name: "Gummibärchen", brand: null, barcode: null, kcal_per_100g: 343, protein_per_100g: 6.9, carbs_per_100g: 77, fat_per_100g: 0.2, serving_g: null, serving_label: null, aliases: ["gummibärchen", "haribo", "weingummi"] },
  { name: "Kartoffelchips", brand: null, barcode: null, kcal_per_100g: 540, protein_per_100g: 6, carbs_per_100g: 50, fat_per_100g: 34, serving_g: null, serving_label: null, aliases: ["chips", "kartoffelchips"] },
  { name: "Salzstangen", brand: null, barcode: null, kcal_per_100g: 380, protein_per_100g: 10, carbs_per_100g: 75, fat_per_100g: 4, serving_g: null, serving_label: null, aliases: ["salzstangen", "brezeln salzig"] },
  { name: "Erdnüsse (geröstet, gesalzen)", brand: null, barcode: null, kcal_per_100g: 596, protein_per_100g: 26, carbs_per_100g: 8, fat_per_100g: 49, serving_g: null, serving_label: null, aliases: ["erdnüsse", "peanuts"] },
  { name: "Eis (Vanille)", brand: null, barcode: null, kcal_per_100g: 207, protein_per_100g: 3.5, carbs_per_100g: 24, fat_per_100g: 11, serving_g: 80, serving_label: "1 Kugel ≈ 80 g", aliases: ["eis", "vanilleeis", "speiseeis"] },
  { name: "Magnum Mandel", brand: "Magnum", barcode: null, kcal_per_100g: 295, protein_per_100g: 4.7, carbs_per_100g: 28, fat_per_100g: 18, serving_g: 86, serving_label: "1 Stück ≈ 86 g", aliases: ["magnum", "magnum mandel"] },
  { name: "Käsekuchen", brand: null, barcode: null, kcal_per_100g: 320, protein_per_100g: 7, carbs_per_100g: 27, fat_per_100g: 20, serving_g: 120, serving_label: "1 Stück ≈ 120 g", aliases: ["käsekuchen", "cheesecake"] },
  { name: "Schwarzwälder Kirschtorte", brand: null, barcode: null, kcal_per_100g: 320, protein_per_100g: 4, carbs_per_100g: 35, fat_per_100g: 18, serving_g: 120, serving_label: "1 Stück ≈ 120 g", aliases: ["schwarzwälder", "kirschtorte"] },
  { name: "Müsliriegel", brand: null, barcode: null, kcal_per_100g: 420, protein_per_100g: 7, carbs_per_100g: 65, fat_per_100g: 14, serving_g: 25, serving_label: "1 Riegel ≈ 25 g", aliases: ["müsliriegel", "haferriegel", "müsli riegel"] },
  { name: "Proteinriegel (typisch)", brand: null, barcode: null, kcal_per_100g: 360, protein_per_100g: 33, carbs_per_100g: 35, fat_per_100g: 10, serving_g: 60, serving_label: "1 Riegel ≈ 60 g", aliases: ["proteinriegel", "eiweißriegel", "protein bar"] },
  { name: "Whey-Protein-Pulver", brand: null, barcode: null, kcal_per_100g: 380, protein_per_100g: 78, carbs_per_100g: 7, fat_per_100g: 5, serving_g: 30, serving_label: "1 Scoop ≈ 30 g", aliases: ["whey", "protein pulver", "eiweißpulver", "proteinshake"] },

  // Getränke
  { name: "Bier (Pils, 5 %)", brand: null, barcode: null, kcal_per_100g: 43, protein_per_100g: 0.5, carbs_per_100g: 3.6, fat_per_100g: 0, serving_g: 500, serving_label: "0,5 l = 500 g", aliases: ["bier", "pils", "helles", "lager"] },
  { name: "Weißwein (trocken)", brand: null, barcode: null, kcal_per_100g: 82, protein_per_100g: 0.1, carbs_per_100g: 2.6, fat_per_100g: 0, serving_g: 200, serving_label: "0,2 l = 200 g", aliases: ["weißwein", "wein weiß"] },
  { name: "Rotwein (trocken)", brand: null, barcode: null, kcal_per_100g: 85, protein_per_100g: 0.1, carbs_per_100g: 2.6, fat_per_100g: 0, serving_g: 200, serving_label: "0,2 l = 200 g", aliases: ["rotwein", "wein rot"] },
  { name: "Cola", brand: null, barcode: null, kcal_per_100g: 42, protein_per_100g: 0, carbs_per_100g: 10.6, fat_per_100g: 0, serving_g: 330, serving_label: "1 Dose 0,33 l = 330 g", aliases: ["cola", "coca cola", "pepsi"] },
  { name: "Apfelschorle", brand: null, barcode: null, kcal_per_100g: 22, protein_per_100g: 0, carbs_per_100g: 5.4, fat_per_100g: 0, serving_g: 500, serving_label: "0,5 l = 500 g", aliases: ["apfelschorle", "schorle"] },
  { name: "Orangensaft", brand: null, barcode: null, kcal_per_100g: 45, protein_per_100g: 0.7, carbs_per_100g: 10.4, fat_per_100g: 0.2, serving_g: 200, serving_label: "1 Glas ≈ 200 g", aliases: ["orangensaft", "o-saft", "ojay"] },
  { name: "Energy Drink (klassisch)", brand: null, barcode: null, kcal_per_100g: 45, protein_per_100g: 0, carbs_per_100g: 11, fat_per_100g: 0, serving_g: 250, serving_label: "1 Dose ≈ 250 g", aliases: ["red bull", "energy drink", "monster"] },
  { name: "Kaffee mit Milch (ungesüßt)", brand: null, barcode: null, kcal_per_100g: 14, protein_per_100g: 0.9, carbs_per_100g: 1.4, fat_per_100g: 0.5, serving_g: 200, serving_label: "1 Tasse ≈ 200 g", aliases: ["kaffee milch", "milchkaffee", "café au lait"] },
  { name: "Latte Macchiato", brand: null, barcode: null, kcal_per_100g: 35, protein_per_100g: 2.5, carbs_per_100g: 3.5, fat_per_100g: 1.2, serving_g: 250, serving_label: "1 Glas ≈ 250 g", aliases: ["latte macchiato", "latte"] },
  { name: "Cappuccino", brand: null, barcode: null, kcal_per_100g: 40, protein_per_100g: 2.7, carbs_per_100g: 4, fat_per_100g: 1.5, serving_g: 150, serving_label: "1 Tasse ≈ 150 g", aliases: ["cappuccino"] },
];

