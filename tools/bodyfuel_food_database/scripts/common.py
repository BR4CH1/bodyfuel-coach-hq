import json
import math
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
DATABASE_URL = os.environ["DATABASE_URL"]

NUTRIENT_FIELDS = (
    "kcal",
    "protein_g",
    "carbohydrates_g",
    "fat_g",
    "fiber_g",
    "sugar_g",
    "saturated_fat_g",
    "salt_g",
    "sodium_mg",
    "alcohol_g",
    "polyols_g",
    "organic_acids_g",
)

SOURCE_METADATA = {
    "bls_4_0": ("BLS 4.0", "CC BY 4.0", "Bundeslebensmittelschlüssel, Max Rubner-Institut"),
    "open_food_facts": ("Open Food Facts", "ODbL", "Open Food Facts"),
    "usda": ("USDA FoodData Central", "CC0 / Public Domain", "USDA FoodData Central"),
}


def clean_number(value):
    if value is None:
        return None
    try:
        if isinstance(value, str):
            value = value.strip().replace(",", ".")
            if value == "":
                return None
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return None
        return number
    except (TypeError, ValueError):
        return None


def looks_like_liquid(name, category=None):
    text = f"{name or ''} {category or ''}".lower()
    if re.search(r"\b(pulver|powder|bohnen|beans|blätter|blaetter|leaves|trocken|dry)\b", text):
        return False
    return bool(
        re.search(
            r"\b(getränk|getraenk|beverage|drink|wasser|water|saft|juice|schorle|"
            r"milch|milk|kaffee|coffee|espresso|tee|tea|cola|soda|limonade|lemonade|"
            r"bier|beer|wein|wine|shake|kefir|sojasauce|soy sauce|essig|vinegar|"
            r"brühe|bruehe|broth|öl|oel|oil|sahne)\b",
            text,
        )
    )


def liquid_density(name, category=None):
    text = f"{name or ''} {category or ''}".lower()
    if re.search(r"\b(öl|oel|oil)\b", text):
        return 0.910
    if re.search(r"\b(milch|milk|kefir|sahne|latte|cappuccino)\b", text):
        return 1.030
    if re.search(r"\b(saft|juice|schorle)\b", text):
        return 1.040
    if re.search(r"\b(bier|beer)\b", text):
        return 1.010
    if re.search(r"\b(wein|wine)\b", text):
        return 0.990
    return 1.000


def has_reliable_liquid_density(name, category=None):
    text = f"{name or ''} {category or ''}".lower()
    return bool(
        re.search(
            r"\b(öl|oel|oil|milch|milk|kefir|sahne|latte|cappuccino|saft|juice|"
            r"schorle|bier|beer|wein|wine|wasser|water|kaffee|coffee|espresso|"
            r"tee|tea|sojasauce|soy sauce|essig|vinegar|brühe|bruehe|broth)\b",
            text,
        )
    )


def set_reference_basis(row, source_basis="g", force_liquid=None):
    """Convert source values once, then store solids per 100 g and liquids per 100 ml."""
    liquid = looks_like_liquid(row.get("name"), row.get("category")) if force_liquid is None else force_liquid
    if not liquid:
        row["unit_type"] = "raw"
        row["macro_reference_unit"] = "g"
        row["density_g_per_ml"] = None
        row["volume_conversion_estimated"] = False
        return row

    density = liquid_density(row.get("name"), row.get("category"))
    row["volume_conversion_estimated"] = (
        source_basis == "g"
        and not has_reliable_liquid_density(row.get("name"), row.get("category"))
    )
    if source_basis == "g":
        for field in NUTRIENT_FIELDS:
            if row.get(field) is not None:
                row[field] = row[field] * density
    elif source_basis != "ml":
        raise ValueError(f"Unbekannte Nährwertbasis: {source_basis}")

    row["unit_type"] = "ml"
    row["macro_reference_unit"] = "ml"
    row["density_g_per_ml"] = density
    return row


def validate_food_row(row):
    required_text = ("source", "source_id", "name")
    if any(not str(row.get(field) or "").strip() for field in required_text):
        raise ValueError("Quelle, source_id und Name sind Pflichtfelder")
    if row["source"] not in SOURCE_METADATA:
        raise ValueError(f"Nicht unterstützte Katalogquelle: {row['source']}")

    limits = {
        "kcal": 900,
        "protein_g": 100,
        "carbohydrates_g": 100,
        "fat_g": 100,
        "fiber_g": 100,
        "sugar_g": 100,
        "saturated_fat_g": 100,
        "salt_g": 100,
        "sodium_mg": 40000,
        "alcohol_g": 100,
        "polyols_g": 100,
        "organic_acids_g": 100,
    }
    for field in ("kcal", "protein_g", "carbohydrates_g", "fat_g"):
        if row.get(field) is None:
            raise ValueError(f"Unvollständige Hauptmakros: {field} fehlt")
    for field, limit in limits.items():
        value = row.get(field)
        if value is not None and not 0 <= value <= limit:
            raise ValueError(f"{field} außerhalb 0–{limit}")

    quality = row.get("quality_score")
    if quality is not None and not 0 <= quality <= 100:
        raise ValueError("quality_score außerhalb 0–100")
    if row.get("unit_type") == "ml" and not 0 < (row.get("density_g_per_ml") or 0) <= 2:
        raise ValueError("Flüssigkeit ohne plausible Dichte")
    return row


def prepare_food_row(row):
    row = dict(row)
    source_name, license_name, citation = SOURCE_METADATA[row["source"]]
    row.setdefault("source_name", source_name)
    row.setdefault("license", license_name)
    row.setdefault("citation", citation)
    row.setdefault("source_verified", False)
    row.setdefault("quality_score", None)
    row.setdefault("volume_conversion_estimated", False)
    row.setdefault("raw_data", json.dumps({}, ensure_ascii=False))
    for field in NUTRIENT_FIELDS:
        row.setdefault(field, None)
    return validate_food_row(row)


def upsert_food(conn, raw_row):
    row = prepare_food_row(raw_row)
    sql = """
    insert into public.nutrition_foods (
        source, source_id, text_id, barcode, name, brand, category, country_codes,
        language_code, source_name, license, citation,
        kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
        fiber_per_100g, sugar_per_100g, saturated_fat_per_100g,
        salt_per_100g, sodium_mg_per_100g, alcohol_per_100g,
        polyols_per_100g, organic_acids_per_100g,
        unit_type, default_state, density_g_per_ml, macro_reference_unit,
        volume_conversion_estimated,
        quality_score, source_verified, source_updated_at, imported_at, raw_data,
        verified_by_coach, is_active
    ) values (
        %(source)s::public.nutrition_food_source, %(source_id)s,
        'import_' || substr(md5(%(source)s || ':' || %(source_id)s), 1, 24),
        case
          when nullif(%(barcode)s, '') is null then null
          when not exists (
            select 1 from public.nutrition_foods nf
            where nf.barcode = %(barcode)s
              and (nf.source <> %(source)s::public.nutrition_food_source or nf.source_id <> %(source_id)s)
          ) then %(barcode)s
          else null
        end,
        %(name)s, %(brand)s, %(category)s, %(country_codes)s, %(language_code)s,
        %(source_name)s, %(license)s, %(citation)s,
        %(kcal)s, %(protein_g)s, %(carbohydrates_g)s, %(fat_g)s,
        %(fiber_g)s, %(sugar_g)s, %(saturated_fat_g)s,
        %(salt_g)s, %(sodium_mg)s, %(alcohol_g)s, %(polyols_g)s, %(organic_acids_g)s,
        %(unit_type)s::public.nutrition_food_unit, 'n_a'::public.nutrition_food_state,
        %(density_g_per_ml)s, %(macro_reference_unit)s, %(volume_conversion_estimated)s,
        %(quality_score)s, %(source_verified)s, %(source_updated_at)s, now(),
        %(raw_data)s::jsonb, false, true
    )
    on conflict (source, source_id) do update set
        barcode = excluded.barcode,
        name = excluded.name,
        brand = excluded.brand,
        category = excluded.category,
        country_codes = excluded.country_codes,
        language_code = excluded.language_code,
        source_name = excluded.source_name,
        license = excluded.license,
        citation = excluded.citation,
        kcal_per_100g = excluded.kcal_per_100g,
        protein_per_100g = excluded.protein_per_100g,
        carbs_per_100g = excluded.carbs_per_100g,
        fat_per_100g = excluded.fat_per_100g,
        fiber_per_100g = excluded.fiber_per_100g,
        sugar_per_100g = excluded.sugar_per_100g,
        saturated_fat_per_100g = excluded.saturated_fat_per_100g,
        salt_per_100g = excluded.salt_per_100g,
        sodium_mg_per_100g = excluded.sodium_mg_per_100g,
        alcohol_per_100g = excluded.alcohol_per_100g,
        polyols_per_100g = excluded.polyols_per_100g,
        organic_acids_per_100g = excluded.organic_acids_per_100g,
        unit_type = excluded.unit_type,
        default_state = excluded.default_state,
        density_g_per_ml = excluded.density_g_per_ml,
        macro_reference_unit = excluded.macro_reference_unit,
        volume_conversion_estimated = excluded.volume_conversion_estimated,
        quality_score = excluded.quality_score,
        source_verified = excluded.source_verified,
        source_updated_at = excluded.source_updated_at,
        raw_data = excluded.raw_data,
        imported_at = now(),
        is_active = true
    """
    conn.execute(sql, row)
