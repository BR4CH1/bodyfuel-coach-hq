import csv, json, zipfile
from pathlib import Path
import psycopg
from common import DATABASE_URL, DATA_DIR, clean_number, upsert_food

NUTRIENTS = {
    1008: "kcal",
    1003: "protein_g",
    1005: "carbohydrates_g",
    1004: "fat_g",
    1079: "fiber_g",
    2000: "sugar_g",
    1258: "saturated_fat_g",
    1093: "sodium_mg",
}

def locate(folder, suffix):
    matches = list(folder.rglob(suffix))
    if not matches:
        raise FileNotFoundError(suffix)
    return matches[0]

def import_archive(zip_path):
    extract_dir = DATA_DIR / zip_path.stem
    if not extract_dir.exists():
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(extract_dir)

    food_csv = locate(extract_dir, "food.csv")
    nutrient_csv = locate(extract_dir, "food_nutrient.csv")
    branded_candidates = list(extract_dir.rglob("branded_food.csv"))
    branded = {}

    if branded_candidates:
        with branded_candidates[0].open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                branded[row["fdc_id"]] = row

    nutrients = {}
    with nutrient_csv.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            nutrient_id = int(row["nutrient_id"])
            field = NUTRIENTS.get(nutrient_id)
            if field:
                nutrients.setdefault(row["fdc_id"], {})[field] = clean_number(row.get("amount"))

    with psycopg.connect(DATABASE_URL) as conn:
        with food_csv.open(encoding="utf-8-sig", newline="") as f:
            for i, raw in enumerate(csv.DictReader(f), 1):
                fdc_id = raw["fdc_id"]
                values = nutrients.get(fdc_id, {})
                brand = branded.get(fdc_id, {})
                sodium = values.get("sodium_mg")
                salt = sodium * 0.0025 if sodium is not None else None

                row = {
                    "source": "usda_" + raw.get("data_type", "unknown").lower().replace(" ", "_"),
                    "source_id": fdc_id,
                    "barcode": brand.get("gtin_upc") or None,
                    "name": raw.get("description") or f"USDA {fdc_id}",
                    "brand": brand.get("brand_owner") or brand.get("brand_name") or None,
                    "category": brand.get("branded_food_category") or raw.get("food_category_id") or None,
                    "country_codes": ["us"],
                    "language_code": "en",
                    "serving_size_g": clean_number(brand.get("serving_size")),
                    "kcal": values.get("kcal"),
                    "protein_g": values.get("protein_g"),
                    "carbohydrates_g": values.get("carbohydrates_g"),
                    "fat_g": values.get("fat_g"),
                    "fiber_g": values.get("fiber_g"),
                    "sugar_g": values.get("sugar_g"),
                    "saturated_fat_g": values.get("saturated_fat_g"),
                    "salt_g": salt,
                    "sodium_mg": sodium,
                    "quality_score": 90 if "Foundation" in raw.get("data_type", "") else 78,
                    "is_verified": "Foundation" in raw.get("data_type", ""),
                    "source_updated_at": raw.get("publication_date") or None,
                    "raw_data": json.dumps({"food": raw, "branded": brand}, ensure_ascii=False),
                }
                try:
                    upsert_food(conn, row)
                except psycopg.errors.UniqueViolation:
                    conn.rollback()
                    row["barcode"] = None
                    upsert_food(conn, row)
                if i % 5000 == 0:
                    conn.commit()
                    print(f"{zip_path.name}: {i:,}")
        conn.commit()

for archive in [
    DATA_DIR / "usda_foundation_2026_04.zip",
    DATA_DIR / "usda_branded_2026_04.zip",
]:
    if archive.exists():
        import_archive(archive)
