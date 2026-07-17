import os
import math
import json
from pathlib import Path
from dotenv import load_dotenv
import psycopg

load_dotenv()

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
DATABASE_URL = os.environ["DATABASE_URL"]

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

def upsert_food(conn, row):
    sql = """
    insert into public.foods (
        source, source_id, barcode, name, brand, category, country_codes,
        language_code, serving_size_g, kcal, protein_g, carbohydrates_g,
        fat_g, fiber_g, sugar_g, saturated_fat_g, salt_g, sodium_mg,
        quality_score, is_verified, source_updated_at, raw_data
    ) values (
        %(source)s, %(source_id)s, %(barcode)s, %(name)s, %(brand)s,
        %(category)s, %(country_codes)s, %(language_code)s,
        %(serving_size_g)s, %(kcal)s, %(protein_g)s, %(carbohydrates_g)s,
        %(fat_g)s, %(fiber_g)s, %(sugar_g)s, %(saturated_fat_g)s,
        %(salt_g)s, %(sodium_mg)s, %(quality_score)s, %(is_verified)s,
        %(source_updated_at)s, %(raw_data)s::jsonb
    )
    on conflict (source, source_id) do update set
        barcode = excluded.barcode,
        name = excluded.name,
        brand = excluded.brand,
        category = excluded.category,
        country_codes = excluded.country_codes,
        serving_size_g = excluded.serving_size_g,
        kcal = excluded.kcal,
        protein_g = excluded.protein_g,
        carbohydrates_g = excluded.carbohydrates_g,
        fat_g = excluded.fat_g,
        fiber_g = excluded.fiber_g,
        sugar_g = excluded.sugar_g,
        saturated_fat_g = excluded.saturated_fat_g,
        salt_g = excluded.salt_g,
        sodium_mg = excluded.sodium_mg,
        quality_score = excluded.quality_score,
        source_updated_at = excluded.source_updated_at,
        raw_data = excluded.raw_data,
        imported_at = now()
    """
    conn.execute(sql, row)
