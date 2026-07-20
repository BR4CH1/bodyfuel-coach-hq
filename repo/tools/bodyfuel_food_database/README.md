# BodyFuel Food Database Import Kit

Dieses Paket erstellt eine eigene Lebensmittel-Datenbank für BodyFuel.

## Empfohlene Quellen

1. BLS 4.0
   - Deutsche Grundnahrungsmittel und Durchschnittswerte
   - 7.140 Lebensmittel, 138 Nährstoffe
   - Lizenz: CC BY 4.0
   - Herausgeber muss genannt werden: Max Rubner-Institut

2. USDA FoodData Central
   - Internationale Grundnahrungsmittel und Markenprodukte
   - Lizenz: CC0 / Public Domain

3. Open Food Facts
   - Markenprodukte, Barcodes und Verpackungsangaben
   - Lizenz: Open Database License (ODbL)
   - Datenqualität schwankt; deshalb wird ein quality_score gespeichert

## Installation

1. PostgreSQL oder Supabase-Projekt anlegen.
2. `sql/01_schema.sql` im SQL Editor ausführen.
3. Python 3.11+ installieren.
4. Im Projektordner ausführen:

   pip install -r requirements.txt

5. Daten laden:

   python scripts/download_sources.py

6. Import starten:

   python scripts/import_bls.py
   python scripts/import_usda.py
   python scripts/import_openfoodfacts.py

## Wichtige Konfiguration

Kopiere `.env.example` zu `.env` und trage deine PostgreSQL-Verbindung ein.

## Datenmodell

Die Tabelle `foods` enthält die wichtigsten Angaben pro 100 g:

- kcal
- protein_g
- carbohydrates_g
- fat_g
- fiber_g
- sugar_g
- saturated_fat_g
- salt_g
- sodium_mg

Zusätzliche Nährstoffe können in `food_nutrients` gespeichert werden.

## Priorität bei Dubletten

1. Manuell geprüfter BodyFuel-Eintrag
2. BLS
3. USDA Foundation / SR Legacy
4. USDA Branded
5. Open Food Facts

Markenprodukte sollten primär über Barcode zusammengeführt werden.
Grundnahrungsmittel sollten nicht allein anhand des Namens automatisch überschrieben werden.
