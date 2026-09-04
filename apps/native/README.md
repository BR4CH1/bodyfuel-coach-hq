# BodyFuel Native

Eigenständige BodyFuel-App für iPhone und Apple Watch. Das Native-Projekt lebt isoliert neben der bestehenden Web-App und kann über EAS vollständig in der Cloud gebaut und an TestFlight übergeben werden.

## Stand dieses Inkrements

### iPhone

- bestehender BodyFuel-/Supabase-Login mit sicherer Session-Ablage in SecureStore
- freier Lauf mit Start, Pause, Fortsetzen und Beenden
- GPS-Spur, Distanz, Live-Pace, Durchschnittspace und Zeit
- Filter für ungenaue GPS-Punkte und unplausible Sprünge
- Karte, Vordergrund-Aufzeichnung und Wachhaltemodus während aktiver Läufe
- lokaler Crash-/Neustart-Entwurf sowie Verlauf der letzten 30 abgeschlossenen Läufe
- haptische und deutsche Sprachwarnungen im Laufkern
- nativer WatchConnectivity-Empfänger mit persistenter Inbox

### Apple Watch

- echte SwiftUI-watchOS-App als eingebettetes App-Target
- echte `HKWorkoutSession` mit Herzfrequenz, Distanz, Zeit, Pace und aktiver Energie
- Pause, Fortsetzen und Beenden direkt am Handgelenk
- Speicherung des Workouts in Apple Health
- zuverlässige Übergabe abgeschlossener Läufe an die iPhone-App, sofort oder gepuffert

## Bewusste Grenzen

Dies ist der erste belastbare vertikale Technik-Schnitt, noch kein Store-Release. Vor einer Beta fehlen insbesondere:

- Supabase-Datenmodell und serverseitiger Sync der abgeschlossenen Läufe
- Live-Datenstrom zwischen iPhone und Watch während eines laufenden Workouts
- planbasierte Pace-/Herzfrequenz-Zielwerte auf der Watch
- Routenimport, Abbiegehinweise und Off-Route-Erkennung
- realer TestFlight-Test auf Manus iPhone und Apple Watch

Die iPhone-GPS-Aufzeichnung läuft aktuell im Vordergrund. Für lange Läufe mit gesperrtem iPhone übernimmt die Watch-Workout-Session die dauerhafte Aufzeichnung.

## Lokal prüfen

Voraussetzung: Node.js 22 und npm 10.

```bash
cd apps/native
npm ci
cp .env.example .env.local
npm run verify
npx expo prebuild --platform ios --clean --no-install
npx expo export --platform ios --output-dir dist-ios --clear
```

Ohne Supabase-Werte startet die App absichtlich im lokalen Technikmodus. Niemals einen Supabase-Service-Role-Key in `EXPO_PUBLIC_*` hinterlegen.

## Cloud-Build ohne Mac

Benötigt werden ein Expo-Konto und eine aktive Apple-Developer-Mitgliedschaft.

1. In Expo ein EAS-Projekt anlegen und dessen Project ID als `EAS_PROJECT_ID` setzen.
2. Die zehnstellige Apple Team ID als `APPLE_TEAM_ID` setzen.
3. `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` als EAS-Environment-Variablen hinterlegen.
4. EAS CLI anmelden und konfigurieren:

   ```bash
   cd apps/native
   npx eas-cli@latest login
   npx eas-cli@latest build:configure
   npx eas-cli@latest build --platform ios --profile preview
   ```

5. Nach einem erfolgreichen Hardwaretest den Production-Build erstellen und an TestFlight senden:

   ```bash
   npx eas-cli@latest build --platform ios --profile production
   npx eas-cli@latest submit --platform ios --profile production
   ```

EAS verwendet für SDK 57 das `sdk-57`-macOS-Image. Das eingebettete Watch-Target wird zusammen mit der iPhone-App signiert. Die GitHub-Action `Native checks` kompiliert das Watch-Target zusätzlich ohne Signierung, damit Swift-Fehler schon vor einem signierten Build sichtbar werden.

## Struktur

```text
src/app/                              iPhone-Screens
src/features/run/domain/              getestete Lauf- und Warnlogik
src/features/run/services/            Entwurf, Verlauf und Watch-Import
modules/bodyfuel-watch-connectivity/  nativer iOS-Empfänger
targets/watch/                        SwiftUI-/HealthKit-Watch-App
app.config.ts                          Expo- und App-Extension-Konfiguration
eas.json                               Cloud-Build-Profile
```
