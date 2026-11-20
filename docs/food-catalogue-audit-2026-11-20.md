# Lebensmittel-Quellenprüfung – 20.11.2026

## Ergebnis
- 372 zentrale Einträge vollständig auf Herkunft, Bezugsgröße, Zustand und Nährwerte geprüft.
- 238 Einträge eindeutig einem Datensatz der offiziellen BLS-4.0-Datei zugeordnet und auf dessen Nährwerte aktualisiert.
- 134 Einträge benötigen eine eindeutige Originalquelle oder ein Produktetikett; ihre Zahlen wurden nicht geraten und sie sind für neue Katalogtreffer/Smart-Pläne nicht freigegeben.
- `foods` und `user_foods` enthalten keine zusätzlichen Einträge. Private Favoriten und vergangene Tracking-Einträge wurden nicht geändert; deren gespeicherte Werte sind keine neu verifizierten Quellen.

## Quelle
Bundeslebensmittelschlüssel 4.0, Max Rubner-Institut, CC BY 4.0:
https://blsdb.de/assets/uploads/BLS_4_0_2025_DE.zip

Die Zuordnungen, verwendeten Nährwerte und ursprünglichen Werte stehen in `src/lib/data/food-catalogue-audit-2026-11-20.json`. Je korrigiertem Eintrag sind BLS-Code, BLS-Bezeichnung und Quellenlink gespeichert; `raw_data.bodyfuel_source_audit.previous` sichert die vorherige Datenbankzeile. Keine automatische Fuzzy-Zuordnung wird geschrieben.

## Nachgewiesene Fehlerkategorien
- Rucola, Schweinefilet, Wassermelone, Weintrauben und abgetropfter Thunfisch waren fälschlich als Flüssigkeiten klassifiziert. Sie haben nun passende Werte pro 100 g.
- Gekochter Bulgur, Couscous, Quinoa und Süßkartoffel waren teilweise als roh klassifiziert. Korrigierte Datensätze verwenden ausdrücklich gekochte BLS-Werte, keine Roh-/Garumrechnung.
- Pfeffer enthielt Kohlenhydrate, die nicht sauber von Ballaststoffen getrennt waren; BLS R258100 liefert 46,07 g verfügbare Kohlenhydrate und 25,5 g Ballaststoffe.
- Leinsamen und zahlreiche weitere generische Lebensmittel hatten voneinander abweichende, nicht durch echte Quellencodes belegte Werte.
- Die Anzeigeprüfung ersetzte bislang widersprüchliche kcal durch eine Berechnung aus möglicherweise ebenfalls falschen Makros. Sie markiert jetzt nur Prüfbedarf und bewahrt die Quellenenergie und Dezimalpräzision.
- Live-Etikettimporte akzeptieren keine Energie ohne explizite 100-g-/100-ml-Basis, keine unvollständigen Hauptmakros und keine starke Energieabweichung; explizite 100-ml-Werte werden nicht mit 100-g-Werten gemischt.
- Wiederverwendung aus Favoriten und zuletzt getrackten Einträgen lädt bei verknüpften Katalog-IDs aktuelle, nicht gesperrte Werte. Auch beim Speichern werden veraltete Entwürfe erneut geprüft; die Originaleinträge bleiben unverändert.

## Offene Quellenprüfung
Insbesondere Marken-/Proteinprodukte, unspezifische Mischgerichte, spezifische Reissorten und Flüssigkeiten benötigen exakt passende Daten. BLS stellt Werte pro 100 g bereit: ohne belastbaren Dichtenachweis werden daraus keine vermeintlich verifizierten 100-ml-Werte. Eine mathematisch plausible Zahl ist kein Nachweis ihrer sachlichen Richtigkeit.

## Folgeprüfung der 134 offenen Einträge
- Alle 134 Einträge erneut gegen BLS 4.0, USDA SR Legacy sowie konkrete Herstelleretiketten geprüft; 23 zusätzlich eindeutig zugeordnet. Insgesamt 261 Quellenzuordnungen, 111 weiter gesperrt.
- 14 weitere BLS-Zuordnungen (unter anderem Frühstücksspeck, tiefgefrorene Erbsen, Lachsschinken, abgetropfte Dosenlinsen, Räucherlachs, Oliven-/Rapsöl in Gramm, Sojasauce in Gramm und Spiegelei) sowie neun USDA-Zuordnungen (weißer Langkornreis roh/gekocht, Edamame zubereitet, griechischer Naturjoghurt fettfrei, Putenhack roh, Rinderhack 5 %/10 %, schwarze Bohnen gekocht, Zimt).
- USDA SR Legacy Originalarchiv: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_%202019-04-02.zip. Verfügbare Kohlenhydrate sind USDA 1005 minus separat belegte Ballaststoffe 1079; Energie bleibt unverändert aus Quelle 1008. Fehlende zusätzliche Nährstoffe werden als fehlend gespeichert, nicht aus Altwerten übernommen.
- Keine Basmati-/Jasminwerte durch allgemeinen weißen Reis ersetzt. Tempeh bleibt gesperrt: SR Legacy 174272 hat keine bezifferte Ballaststoffangabe, daher keine belegbare Aufteilung der Kohlenhydrate.
- Die Herstelleretiketten für Coca-Cola Original/Zero bestätigen Werte pro 100 ml, liefern aber keine 100-g-Basis/Dichte. Der gefundene Sportness Eiskaffee enthält 0,3 g Fett/100 ml statt bisher 0 g; Produktidentität und Dichte fehlen. Diese Einträge bleiben gesperrt, ihre Werte wurden nicht als verifizierte 100-g-Werte ausgegeben.
- Jede Einzelentscheidung inklusive Quellenlink, aktuellem Vorher-Snapshot und begründetem Blocker steht in `src/lib/data/food-catalogue-followup-2026-11-20.json`; lesbare Liste in `docs/food-catalogue-followup-2026-11-20.md`.
- Folgeprüfungen verwenden eine eigene Revision pro Eintrag, damit gleichdatierte Korrekturen nicht übersprungen und beim Wiederholen nicht rückgängig gemacht werden. Ursprüngliche Quellenprüfung und Vorherwerte bleiben erhalten; Schreibkonflikte werden gemeldet.
- 28 Fachtests bestanden; Abgleich im echten Owner-Zugang ausgeführt und wiederholt. Alle 134 Ergebnisse aus der Datenbank rückgelesen und auf Werte, Zustand, Revision und Sperren geprüft. 260 aktive Einträge freigegeben; der bereits inaktive Eintrag Vollei bleibt inaktiv. Historische Logs unverändert, nicht veröffentlicht.

## Verifikation
- Alle 372 Datenbankzeilen gegen den Prüfbericht abgeglichen; keine Abweichungen über der Datenbankpräzision von 0,01.
- 248 Fachtests bestanden, darunter 13 neue Quellendaten-/Importtests und acht Energieprüfungen.
- Owner-autorisierter Verwaltungsablauf mit realem Konto ausgeführt und erneut ausgeführt: keine Doppeländerungen, 372 geprüft / 238 abgeglichen / 134 offen, keine Seitenfehler.
- Handyansicht 402 × 874 ohne horizontalen Überlauf geprüft. Nicht veröffentlicht; Datenänderungen gelten bereits im gemeinsamen Backend.
- Zusätzlicher realer Trackingweg: Hinzufügen → Suche „Pfeffer“ → Auswahl → 150-g-Portion zeigt 456 kcal, 16,4 g Protein, 69,1 g Kohlenhydrate und 4,2 g Fett auf Desktop und Handy. Keine Testportion in das echte Ernährungstagebuch geschrieben.