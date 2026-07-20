from pathlib import Path
import requests
from tqdm import tqdm

DATA_DIR = Path("./data")
DATA_DIR.mkdir(exist_ok=True)

SOURCES = {
    "bls_4_0.zip": "https://blsdb.de/assets/uploads/BLS_4_0_2025_DE.zip",
    "usda_foundation_2026_04.zip": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip",
    "usda_branded_2026_04.zip": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_branded_food_csv_2026-04-30.zip",
    "openfoodfacts.tsv.gz": "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz",
}

HEADERS = {
    "User-Agent": "BodyFuel-Food-Database/1.0 (replace-with-your-contact-email)"
}

def download(url, target):
    if target.exists():
        print(f"Bereits vorhanden: {target}")
        return
    with requests.get(url, headers=HEADERS, stream=True, timeout=120) as response:
        response.raise_for_status()
        total = int(response.headers.get("content-length", 0))
        with target.open("wb") as f, tqdm(total=total, unit="B", unit_scale=True, desc=target.name) as bar:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    bar.update(len(chunk))

for filename, url in SOURCES.items():
    try:
        download(url, DATA_DIR / filename)
    except Exception as exc:
        print(f"Fehler bei {filename}: {exc}")
        print("Lade die Datei alternativ manuell von der offiziellen Quelle herunter.")
