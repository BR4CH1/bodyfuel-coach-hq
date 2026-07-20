# Sprint 1 – Slice 19: SSR-Client-Grenzen

## Ziel

Den Cloudflare-/Nitro-Build entlasten, indem eindeutig browsergebundene Bibliotheken nicht mehr statisch in den SSR-Modulgraph gelangen.

## Ergebnis der drei Isolationsläufe

Die in Slice 18 vorbereiteten Varianten wurden tatsächlich gegeneinander ausgeführt:

| Variante                 | Ergebnis       | Letzte Phase      |     Max. RSS | Nitro-Module beim Abbruch |
| ------------------------ | -------------- | ----------------- | -----------: | ------------------------: |
| ohne MCP                 | kein Abschluss | `nitro:transform` | ca. 3.093 MB |                       431 |
| ohne PWA                 | kein Abschluss | `nitro:transform` | ca. 3.393 MB |                     1.436 |
| SSR als einzelnes Bundle | kein Abschluss | `nitro:transform` | ca. 3.265 MB |                     1.665 |

Damit sind MCP, PWA und der SSR-Chunkgraph nicht die alleinige Ursache. Der Engpass liegt im finalen Nitro-/Cloudflare-Bundle, das weiterhin viele Browserbibliotheken verarbeitet.

## Umgesetzte Client-Grenzen

Folgende Pakete werden jetzt nur noch im Browserpfad geladen:

- `@stripe/stripe-js`
- `@stripe/react-stripe-js`
- `@zxing/browser`
- `@zxing/library`
- `html-to-image`
- `jszip`
- `react-easy-crop`

### Technische Änderungen

- Stripe Checkout besitzt nun eine SSR-sichere Wrapper-Komponente und eine separate `*.client.tsx`-Implementierung.
- Stripe.js wird erst bei tatsächlicher Browsernutzung importiert.
- Barcode-Scanner lädt ZXing erst im Kamera-Fallback.
- Profilbild-Cropper wird über einen clientseitigen Lazy-Import geladen.
- Player-Card-PNG-Export lädt `html-to-image` erst beim Export.
- ZIP-Bulk-Export lädt `jszip` erst nach Klick auf den Export-Button.
- Neue Browser-Import-Prüfung verhindert zukünftige statische Imports dieser Pakete außerhalb von `*.client.*`.

## Gemessener Effekt

Der Client-Build zeigte bereits eine deutliche bessere Aufteilung:

- `NutritionTracker`: ca. **546,08 kB → 91,54 kB**
- `jszip`: eigener Chunk mit ca. **97,15 kB**
- ein zuvor großer gemeinsamer Chunk wurde auf ca. **459,06 kB** reduziert

Der vollständige Nitro-Lauf wurde dadurch noch nicht stabil: Er erreichte erneut den speicherintensiven finalen Transformationsschritt und führte in der 4-GB-Prüfumgebung schließlich zu einem Container-Neustart. Dieser Slice verbessert den Modulgraph nachweislich, ist aber ausdrücklich noch nicht der endgültige Nitro-Fix.

## Prüfungen vor dem Nitro-Volltest

- TypeScript: bestanden
- ESLint der geänderten Dateien: bestanden
- Vitest: **123/123 Tests bestanden**
- Client-Build: bestanden
- SSR-Vite-Build: bestanden
- Browser-only-Import-Guard: bestanden

## Nächster technischer Hebel

Die nächsten großen Pakete im Nitro-Graph sind:

1. `recharts` – mehrere Charts werden noch serverseitig importiert.
2. `upng-js` inklusive `pako` – wird für die serverseitige Spieler-Freistellung benötigt.
3. weitere routeweite UI-Abhängigkeiten, die für SSR keinen funktionalen Wert liefern.

Der nächste Slice sollte deshalb die Recharts-Komponenten hinter echte Client-Grenzen verschieben. Danach wird erneut ein vollständiger Nitro-Lauf gemessen.
