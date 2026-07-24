import csv, gzip, json
import psycopg
from common import (
    DATABASE_URL,
    DATA_DIR,
    clean_number,
    looks_like_liquid,
    set_reference_basis,
    upsert_food,
)

path = DATA_DIR / "openfoodfacts.tsv.gz"

def quality_score(row, ambiguous_basis=False):
    required = ["product_name", "energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"]
    present = sum(bool(row.get(k)) for k in required)
    score = 25 + present * 12
    if row.get("code"):
        score += 10
    if row.get("brands"):
        score += 5
    if ambiguous_basis:
        score -= 20
    return min(score, 95)


def source_basis(raw, physical_liquid):
    basis = (raw.get("nutrition_data_per") or "").lower().replace(" ", "")
    if "100ml" in basis:
        return "ml", False
    if "100g" in basis:
        return "g", False

    quantity_unit = (raw.get("product_quantity_unit") or "").lower().strip()
    if physical_liquid and quantity_unit in {"ml", "cl", "l"}:
        # OFF's *_100g export fields represent the product's 100 ml basis here,
        # but the missing explicit basis keeps the row below the Smart threshold.
        return "ml", True
    return "g", physical_liquid

with psycopg.connect(DATABASE_URL) as conn:
    with gzip.open(path, "rt", encoding="utf-8", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        rejected = 0
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

            category = (raw.get("categories_de") or raw.get("categories") or "").strip() or None
            quantity_unit = (raw.get("product_quantity_unit") or "").lower().strip()
            physical_liquid = quantity_unit in {"ml", "cl", "l"} or looks_like_liquid(name, category)
            basis, ambiguous_basis = source_basis(raw, physical_liquid)

            row = {
                "source": "open_food_facts",
                "source_id": raw.get("code") or "",
                "barcode": raw.get("code") or None,
                "name": name,
                "brand": (raw.get("brands") or "").strip() or None,
                "category": category,
                "country_codes": [x for x in (raw.get("countries_tags") or "").split(",") if x],
                "language_code": "de",
                "kcal": kcal,
                "protein_g": protein,
                "carbohydrates_g": carbs,
                "fat_g": fat,
                "fiber_g": clean_number(raw.get("fiber_100g")),
                "sugar_g": clean_number(raw.get("sugars_100g")),
                "saturated_fat_g": clean_number(raw.get("saturated-fat_100g")),
                "salt_g": salt,
                "sodium_mg": sodium,
                "alcohol_g": clean_number(raw.get("alcohol_100g")),
                "polyols_g": clean_number(raw.get("polyols_100g")),
                "organic_acids_g": clean_number(raw.get("organic-acids_100g")),
                "quality_score": quality_score(raw, ambiguous_basis),
                "source_verified": False,
                "source_updated_at": raw.get("last_modified_datetime") or None,
                "raw_data": json.dumps(raw, ensure_ascii=False),
            }
            set_reference_basis(row, source_basis=basis, force_liquid=physical_liquid)
            try:
                upsert_food(conn, row)
            except ValueError:
                rejected += 1
                continue

            if i % 5000 == 0:
                conn.commit()
                print(f"{i:,} Zeilen verarbeitet, {rejected:,} verworfen")
    conn.commit()
