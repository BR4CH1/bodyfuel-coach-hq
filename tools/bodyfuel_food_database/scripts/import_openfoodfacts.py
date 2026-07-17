import csv, gzip, json
import psycopg
from common import DATABASE_URL, DATA_DIR, clean_number, upsert_food

path = DATA_DIR / "openfoodfacts.tsv.gz"

def quality_score(row):
    required = ["product_name", "energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"]
    present = sum(bool(row.get(k)) for k in required)
    score = 25 + present * 12
    if row.get("code"):
        score += 10
    if row.get("brands"):
        score += 5
    return min(score, 95)

with psycopg.connect(DATABASE_URL) as conn:
    with gzip.open(path, "rt", encoding="utf-8", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        for i, raw in enumerate(reader, 1):
            name = (raw.get("product_name_de") or raw.get("product_name") or "").strip()
            if not name:
                continue
            kcal = clean_number(raw.get("energy-kcal_100g"))
            protein = clean_number(raw.get("proteins_100g"))
            carbs = clean_number(raw.get("carbohydrates_100g"))
            fat = clean_number(raw.get("fat_100g"))
            if all(v is None for v in [kcal, protein, carbs, fat]):
                continue

            salt = clean_number(raw.get("salt_100g"))
            sodium = clean_number(raw.get("sodium_100g"))
            if sodium is not None:
                sodium *= 1000

            row = {
                "source": "open_food_facts",
                "source_id": raw.get("code") or f"row-{i}",
                "barcode": raw.get("code") or None,
                "name": name,
                "brand": (raw.get("brands") or "").strip() or None,
                "category": (raw.get("categories_de") or raw.get("categories") or "").strip() or None,
                "country_codes": [x for x in (raw.get("countries_tags") or "").split(",") if x],
                "language_code": "de",
                "serving_size_g": clean_number(raw.get("serving_quantity")),
                "kcal": kcal,
                "protein_g": protein,
                "carbohydrates_g": carbs,
                "fat_g": fat,
                "fiber_g": clean_number(raw.get("fiber_100g")),
                "sugar_g": clean_number(raw.get("sugars_100g")),
                "saturated_fat_g": clean_number(raw.get("saturated-fat_100g")),
                "salt_g": salt,
                "sodium_mg": sodium,
                "quality_score": quality_score(raw),
                "is_verified": False,
                "source_updated_at": None,
                "raw_data": json.dumps(raw, ensure_ascii=False),
            }
            try:
                upsert_food(conn, row)
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                row["barcode"] = None
                upsert_food(conn, row)

            if i % 5000 == 0:
                conn.commit()
                print(f"{i:,} Zeilen verarbeitet")
    conn.commit()
