
## Ziel
Eine kostenlose, eigenständig wirkende Tracker-App unter `/tracker` als Lead-Magnet. Free User leben in ihrem eigenen Bereich, sind im Coach-Dashboard sichtbar, und werden über Trigger-Banner zu Coaching-Kunden konvertiert.

## 1. Rollen & Datenmodell (Migration)

Neue Rolle in `app_role`-Enum: `'free'`. Bestehende Trennung:
- `'coach'` → Coach
- `'client'` → bezahlter Coaching-Kunde
- `'free'` → kostenloser Tracker-User (NEU)

Neue Tabellen (mit GRANTs + RLS scoped auf `auth.uid()`):
- `water_logs` ist bereits vorhanden → wiederverwenden.
- `activity_logs` (NEU): `user_id`, `date`, `steps`, `training_done bool`.
- `free_user_events` (NEU): `user_id`, `event` (`'signup'`, `'first_track'`, `'upgrade_clicked'`, `'converted'`), `created_at` — fürs Conversion-Tracking.

Helper:
- Funktion `is_free_user(uid)` / nutze `has_role(uid,'free')`.
- Trigger `handle_new_user` erweitern: wenn `raw_user_meta_data->>'tier' = 'free'`, dann Rolle `free` statt `client`.

Punkte: bestehendes `daily_checks` + `performance_points` + `recompute_user_points` System wiederverwenden. Free-User dürfen daily_checks schreiben (RLS prüfen — heute schon `user_id = auth.uid()`).

## 2. Public Landingpage `/tracker`

Neue Route `src/routes/tracker.tsx` (öffentlich, SSR, eigene SEO-Metadaten, og:image).
- Hero: „BODYFUEL TRACKER – KOSTENLOS" mit grün/schwarz/weiß BodyFuel-Design.
- Feature-Grid: Kalorien, Protein, Carbs, Fat, Wasser, Gewicht, Punkte, Level.
- Sekundärer CTA: „Du willst mehr? → Coaching anfragen".
- Primärer CTA: „Kostenlos starten" → `/tracker/signup`.

## 3. Free-User Signup/Login

- `src/routes/tracker.signup.tsx`: Form mit Vorname, Nachname, E-Mail, Passwort (Pflicht) + optional Gewicht, Größe, Geschlecht, Geburtsdatum (collapsible).
- Validierung mit Zod.
- `supabase.auth.signUp` mit `data: { display_name, first_name, last_name, tier: 'free', height_cm, gender, birthdate }`.
- Trigger `handle_new_user` legt Profil + Rolle `free` an; optionale Body-Maße schreibt der Client nach Signup in `body_measurements` / `profiles`.
- `src/routes/tracker.login.tsx`: schlankes Login (oder Wiederverwendung von `/auth` mit Redirect-Logik).
- Nach Login: Free-User → `/tracker/app`, Coaching-User → `/dashboard`, Coach → `/coach`.

## 4. Free-User App-Bereich `/tracker/app/*`

Neue pathless Layout-Route `src/routes/_free.tsx` (Gate: Rolle muss `free` sein, sonst Redirect zur passenden Welt). Routen:
- `tracker.app.tsx` — Dashboard: Heute, Streak, Level/XP, Wasser, Kalorien-Donut.
- `tracker.app.nutrition.tsx` — kompakter NutritionTracker (Wiederverwendung der bestehenden Komponente in „free mode": ohne Coaching-Plan, nur freies Tracking).
- `tracker.app.weight.tsx` — Gewicht eintragen + Verlauf (WeightProgressChart wiederverwenden).
- `tracker.app.water.tsx` — Wasserziel + Fortschritt.
- `tracker.app.activity.tsx` — Schritte + Training-Toggle.
- `tracker.app.achievements.tsx` — Level, XP, Streaks, Achievements.
- `tracker.app.profile.tsx` — Stammdaten + Logout.

Bottom-Tab-Nav (mobile-first) für die 5 Hauptbereiche. Eigene App-Shell `FreeAppLayout` (analog `AppLayout` aber stripped-down).

Gating der bestehenden Coaching-Routen: in `_authenticated/route.tsx` oder via per-Route `beforeLoad`: wenn Rolle `free` → Redirect auf `/tracker/app`. Coach-Routen bleiben für Coach-Rolle.

## 5. Punkte / Level / Achievements

Wiederverwendung des bestehenden Systems (`daily_checks`, `user_points`, `achievements`, `process_daily_check`).
- Eigene schlanke `FreeDailyCheck`-Komponente, die Tasks setzt (Protein/Kalorien/Wasser/Gewicht/Training/Schritte) und in `daily_checks.tasks` schreibt.
- Punkte/Level-Anzeige nutzt `user_points` (XP = total_points, Level = `1 + total_points/100`).
- Achievements: bestehende Tabelle, plus Seed-Inserts für „100 L Wasser", „10 kg verloren" via Migration.

## 6. Coach-Dashboard Integration

Datei: `src/routes/coach.customers.index.tsx` erweitern.
- Status-Badge: 🟢 Free / 🔥 Coaching anhand Rolle.
- Filter-Tabs: Alle | Coaching | Free | Aktiv | Inaktiv (Inaktiv = kein `daily_checks` in 14 Tagen).
- Spalten: Name, Email, Registriert, Aktuelles Gewicht, Level, Punkte, Streak, Letzter Login (aus `auth.users.last_sign_in_at` via server fn mit `supabaseAdmin`), Ø Nutzung (Checks/Woche).
- Neue KPI-Karte oben: Free Users, Coaching Users, Conversion Rate (= coaching / (free+coaching)).
- Neue Server-Funktion `getFreeUserStats` (`createServerFn` + `requireSupabaseAuth` + has_role(coach)-Check + supabaseAdmin im Handler).

## 7. Conversion-Prompts

Neue Komponente `FreeUpsellBanner` in FreeAppLayout. Trigger via Server-Funktion `getFreeUserUpsellState` (auth, RLS):
- Tage seit Signup ≥ 7 → „7-Tage"-Banner.
- Tage seit Signup ≥ 30 → „30-Tage"-Banner.
- Anteil Tage in letzten 14 mit verfehltem Proteinziel ≥ 50 % → „Protein"-Banner.
- Dismissible (gespeichert in `free_user_events` mit `event='banner_dismissed_X'`).
- Klick auf CTA → `event='upgrade_clicked'` insert + Link auf Coaching-Anfrage (`/`).

## 8. Design

Bestehendes BodyFuel-Design (gold/schwarz für Coaching). Für Tracker zusätzliche Akzentfarbe „BodyFuel Grün" als CSS-Token `--tracker-green` in `src/styles.css` (semantic). Hochwertig: große Zahlen, klare Hierarchie, dunkle Cards, sanfte Gradients, gleiche Komponenten-Sprache wie Coaching-App. Mobile-first.

## Technische Details

- Migration: enum extend `app_role` add `'free'`; `handle_new_user` updaten; `activity_logs`, `free_user_events` Tabellen + GRANTs + RLS; Seed neue Achievements.
- Alle DB-Reads in Free-Routen via authenticated `supabase` client (RLS schützt Daten).
- Coach-Dashboard-Reads via `createServerFn` mit `requireSupabaseAuth` + `has_role(coach)`-Gate; `supabaseAdmin` nur für `auth.users.last_sign_in_at`.
- Tracker-Routen sind public (Landing, Signup, Login). App-Bereich `tracker.app.*` liegt logisch unter einem Gate-Layout, das `has_role(user,'free')` erzwingt.
- SEO: Landingpage hat eigenes head() mit Title, Description, OG-Tags + generiertem og:image.

## Out of Scope (für diesen Durchgang)
- Push-Notifications, E-Mail-Drip-Kampagnen für Free User.
- Detaillierte CRM-Notizen/Tags pro Free User.
- Stripe-Checkout fürs Coaching-Upgrade (CTA verweist auf bestehendes Anfrage-Formular).
