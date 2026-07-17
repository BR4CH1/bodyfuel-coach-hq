"""
BLS 4.0 Importer

Die genaue Datei- und Spaltenstruktur des offiziellen BLS-Archivs kann sich ändern.
Das Skript erkennt CSV-Dateien und druckt zunächst deren Spaltenüberschriften aus.

Danach müssen die Mappings unten einmalig anhand der gelieferten Spaltennamen
angepasst werden. So werden keine vermeintlich "korrekten" Werte falsch zugeordnet.
"""
import csv, zipfile
from pathlib import Path
from common import DATA_DIR

archive = DATA_DIR / "bls_4_0.zip"
extract_dir = DATA_DIR / "bls_4_0"

if not archive.exists():
    raise FileNotFoundError("BLS-Archiv fehlt. Bitte download_sources.py ausführen.")

if not extract_dir.exists():
    with zipfile.ZipFile(archive) as z:
        z.extractall(extract_dir)

csv_files = list(extract_dir.rglob("*.csv"))
if not csv_files:
    print("Keine CSV-Dateien gefunden. Prüfe, ob das Archiv XLSX-Dateien enthält.")
else:
    for path in csv_files:
        print("\\nDATEI:", path)
        with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as f:
            reader = csv.reader(f, delimiter=";")
            try:
                print("SPALTEN:", next(reader))
            except StopIteration:
                pass

print("""
Nächster Schritt:
Ordne die BLS-Spalten den BodyFuel-Feldern zu:
- Lebensmittelcode -> source_id
- Lebensmittelname -> name
- Energie kcal/100 g -> kcal
- Protein -> protein_g
- Kohlenhydrate -> carbohydrates_g
- Fett -> fat_g
- Ballaststoffe -> fiber_g
- Zucker -> sugar_g
- gesättigte Fettsäuren -> saturated_fat_g
- Natrium -> sodium_mg
- Salz, falls vorhanden -> salt_g

Absichtlich erfolgt kein blindes automatisches Mapping, damit keine falschen
Nährstoffwerte durch geänderte oder mehrdeutige BLS-Spalten entstehen.
""")
