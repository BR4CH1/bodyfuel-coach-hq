## Ziel

BodyFuel wird vom „Selbstkauf-Shop" zum gateten Coaching-System. Interessenten können nur ein Erstgespräch anfragen. Der Coach legt Kunden an, vergibt individuelle Preise und Laufzeiten. Kunden sehen ihren eigenen Preis, können verlängern (PayPal.Me, manuelle Bestätigung) und nutzen das bestehende Dashboard.

## Phase A — Datenmodell (Migration)

Neue / geänderte Tabellen:

- `customer_packages` — pro Kunde ein aktives Paket
  - `user_id` (FK auth.users), `package` (starter|coaching|premium), `price_eur`, `start_date`, `end_date`, `is_active`, `notes`
- `leads` — Erstgespräch-Anfragen (ersetzt öffentliche Nutzung von `bookings`)
  - `name`, `email`, `phone`, `goal`, `current_weight`, `desired_package`, `message`, `status` (new|contacted|converted|declined)
- `payment_history`
  - `user_id`, `customer_package_id`, `amount_eur`, `payment_date`, `method` (paypal_me|other), `status` (pending|confirmed), `note`
- `bookings` → behalten oder droppen? Wird gedroppt (war Teil des entfernten PayPal-Flows).
- `profiles`: zusätzlich `phone` (optional, für Kontakt).

RLS:
- Kunde liest/aktualisiert nur eigene Zeilen in `customer_packages`/`payment_history`.
- Coach (`has_role 'coach'`) liest/schreibt alles.
- `leads`: anonym INSERT, Coach liest/aktualisiert.

## Phase B — Landingpage Umbau (`src/routes/index.tsx`)

- Neue Sektionen: „Für wen", „Was ist BodyFuel", „Das System" (3 Schritte), „Gamification", „Transformationen", „Über den Coach Manu".
- Pakete-Sektion: Preise bleiben sichtbar, aber **alle CTAs** werden zu „Kostenloses Erstgespräch vereinbaren" → öffnet Kontaktformular (Dialog oder `/erstgespraech` Route).
- `BookingDialog` wird ersetzt durch `ContactDialog` (Felder: Name, E-Mail, Tel, Ziel, Gewicht, Wunschpaket, Nachricht) → schreibt in `leads`.
- Footer: Impressum, Datenschutz, Instagram, Kontakt; § 19 UStG Hinweis.
- Login-Link bleibt (nur Kunden mit Account).
- **Keine** Registrierungs-/„Jetzt kaufen"-Buttons mehr.

Dateien: ersetze `src/components/bodyfuel/BookingDialog.tsx` → `ContactDialog.tsx`; lösche `src/routes/danke.tsx` (oder repurpose zu „Danke für deine Anfrage").

## Phase C — Kunden-Onboarding via Magic Link

Coach legt Kunde an (siehe Phase D). Server-Function:
- prüft `has_role('coach')`
- erstellt `auth.users` Eintrag via `supabaseAdmin.auth.admin.inviteUserByEmail()` (versendet Magic Link)
- erzeugt `profiles`, `user_roles` (client), `customer_packages` Zeile
- Kunde klickt Link → setzt Passwort → landet im Dashboard

## Phase D — Adminbereich (neue Routen unter `_authenticated`)

- `/coach/customers` — Tabelle aller Kunden mit: Name, E-Mail, Paket, Preis, Status, Start, Ende, letzter Check-in, Aktionen (Ansehen, Bearbeiten, Aktivieren/Deaktivieren).
- `/coach/customers/new` — Formular: Name, E-Mail, Tel, Paket, individueller Preis, Startdatum, Laufzeit (Tage), Notizen.
- `/coach/customers/$id` — Detailseite: Paket/Preis ändern, Laufzeit verlängern manuell, Zahlung als bezahlt markieren, Zahlungshistorie, Notizen.
- `/coach/leads` — Tabelle der Erstgespräch-Anfragen; Status setzen.

Bestehende `/coach`-Routen (Client-Übersicht) bleiben für Check-in/Pläne-Verwaltung.

## Phase E — Kunden-Dashboard erweitern (`/dashboard`)

Zusätzlich anzeigen (aus `customer_packages` des eingeloggten Users):
- Aktuelles Paket + individueller Preis
- Startdatum, Ablaufdatum, Restlaufzeit (Tage)
- Zahlungsstatus
- Button „Coaching verlängern" → öffnet `paypal.me/ManuSchrader/[individuellerPreis]EUR` und legt `payment_history` Zeile (status=pending) an
- Bestehende Level/Streak/Punkte-Anzeige bleibt

## Phase F — Verlängerung & Zahlungshistorie

- Kunde klickt „Verlängern" → Server-Function legt `payment_history` (pending) an, gibt PayPal.Me URL zurück.
- Coach sieht pending Zahlungen, bestätigt → setzt `status=confirmed`, verlängert `customer_packages.end_date` um 30 Tage.
- Historie sichtbar im Kunden-Dashboard und in Admin-Detailseite.

## Technische Details

- Server-Functions in `src/lib/coaching.functions.ts` mit `requireSupabaseAuth` + Coach-Check (`has_role`).
- Kunde-Server-Functions in `src/lib/customer.functions.ts` (eigene Daten lesen, Verlängerung anstoßen).
- Magic Link: `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: '${SITE}/welcome' })`. Für Brand-Mails optional Auth-Email-Templates später.
- Demo-Login-Flow (Andreas/Patrick/Luisa) bleibt unangetastet — sie sind Mock-Daten in `src/lib/bodyfuel/data.ts`.
- Echte Kunden in DB ergänzen das Mock-System; Dashboard liest Paket/Preis aus DB, Punkte/Checks bleiben Mock (Umstellung auf echte DB-Speicherung wäre eigene große Aufgabe — **nicht in diesem Umfang**).
- PayPal.Me Konstante: `paypal.me/ManuSchrader` (bestehend).

## Was NICHT in dieser Runde

- Echte Speicherung von Check-ins/Punkten/Gewicht/Fotos in DB (bleibt Mock im LocalStorage-Style wie aktuell).
- Hochladen von Ernährungsplänen (bereits existierender `nutrition_plans`-Flow bleibt).
- Eigene Impressum/Datenschutz-Inhalte (Platzhalter-Seiten, Texte trägst du nach).
- Automatische PayPal-Webhooks.

## Reihenfolge

1. Migration (Phase A) — du musst sie approven, dann geht's weiter
2. Server-Functions + Magic-Link-Onboarding (C, F-Backend)
3. Adminbereich-Routen (D)
4. Kunden-Dashboard-Erweiterung + Verlängerung (E, F-Frontend)
5. Landingpage-Umbau + ContactDialog (B)

Soll ich so loslegen?