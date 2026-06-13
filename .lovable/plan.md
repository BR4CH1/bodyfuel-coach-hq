## Bulls Performance Hub — Implementierungsplan

Ein kostenloser, geschützter Gruppenbereich für Coesfeld Bulls Spieler. Technisch als generisches Gruppensystem („access groups") aufgebaut, damit später weitere Gruppen (Running Team, SGZ, Premium) ergänzt werden können.

---

### 1. Datenmodell (Migration)

**Generisches Gruppensystem**
- Neuer Enum `app_group`: `bulls`, (vorbereitet für `running_team`, `sgz`, `premium`).
- Neue Tabelle `public.user_groups` (user_id, group, granted_at) — analog zu `user_roles`.
- Security-definer Funktion `public.has_group(_user_id, _group)` für RLS.
- Coach kann Gruppen vergeben (Policy via `has_role(auth.uid(), 'coach')`).

**Bulls-spezifisch**
- `bulls_profiles` (user_id PK, first_name, last_name, email, weight_kg, height_cm, position, main_goal, onboarded_at).
  - Enums: `bulls_position` (QB, RB, WR, TE, OL, DL, LB, DB, KP, COACH), `bulls_goal` (fat_loss, muscle_gain, performance, general_fitness).
- `bulls_weight_logs` (user_id, date, weight_kg).
- `bulls_progress_photos` (user_id, date, front_path, side_path, back_path).
- `bulls_hub_events` (user_id, kind, occurred_at) — tracking für Starter Score (z. B. „nutrition_plan_opened", „training_plan_opened").
- Storage Bucket `bulls-progress-photos` (privat, RLS pro user).

RLS auf allen Tabellen: nur eigener Datensatz; Coach kann lesen.

---

### 2. Admin-Verwaltung

**Nutzer anlegen / bearbeiten** (`coach.customers.new.tsx`, `coach.customers.$userId.tsx`)
- Drei unabhängige Toggles:
  - 🏈 Bulls-Mitglied
  - 💪 Aktiver Coaching-Kunde (bestehender Mechanismus)
  - ⭐ Premium-Mitglied (Gruppe vorbereitet, UI aktiv)
- Beim Anlegen + Einladen: Checkbox „Bulls Performance Hub freischalten".
- Server-Funktionen `setUserGroup`/`removeUserGroup` mit Admin-Check.

**Kundenliste** (`coach.customers.index.tsx`)
- 🏈 Badge neben Bulls-Mitgliedern.
- Filter-Dropdown: Alle / Bulls-Mitglieder / Coaching-Kunden / Inaktiv.

---

### 3. Bulls Performance Hub (Spieler-Sicht)

**Sichtbarkeit**
- Navigation (`AppLayout.tsx`): Menüpunkt „Bulls Performance Hub" erscheint nur, wenn `has_group('bulls')`. Session lädt Gruppen mit.
- Route `/bulls/*` unter `_authenticated`, mit eigener Group-Gate (redirect bei kein Bulls-Zugang).

**Routen**
- `/bulls` — Onboarding-Wizard (wenn `bulls_profiles` leer) ODER Dashboard.
- `/bulls/nutrition` — Mini-Ernährungsplan (Trainingstag / Restday Tabs).
- `/bulls/training` — Mini-Trainingsplan (Tabs nach Ziel).
- `/bulls/benchmarks` — Positions-Benchmarks (Tabs nach Position).
- `/bulls/weight` — Gewichtstracking + Recharts Liniendiagramm + Trend.
- `/bulls/photos` — Optionale Fortschrittsfotos (Front/Seite/Rücken, privater Storage-Bucket).

**Dashboard (`/bulls` post-onboarding)**
- Hero: „Willkommen im Bulls Performance Hub".
- Karten:
  - Proteinziel: `gewicht * 2` g/Tag.
  - Wasserziel: `gewicht * 35` ml/Tag.
  - Fokus-Karte: Text abhängig vom Hauptziel.
  - BodyFuel Starter Score 0–100 mit Fortschrittsbalken + Stufentext.
  - Quick-Links zu allen Bereichen.
- Hinweis-Box: „Die offizielle Bulls Challenge läuft weiterhin über WhatsApp."

**Onboarding**
- Pflichtfelder: Vorname, Nachname, Email (prefill aus Auth), Gewicht, Größe, Position (Select), Hauptziel (Select).
- Speichert in `bulls_profiles`, vergibt Score-Event „onboarding_complete".

**Starter Score**
- Berechnet aus `bulls_hub_events` + Daten:
  - onboarding=20, goal=15, weight_logged=15, nutrition_opened=15, training_opened=15, weight_logged_2x=20.
- Event-Tracking beim Routenaufruf (via `useEffect` einmalig pro Tag/Event).

**Coaching-Upsell**
- Wiederverwendbare `<CoachingUpsell />` Komponente unten auf jeder Bulls-Seite mit Buttons „Individuelles Coaching anfragen" (→ `/`-Lead-Form) und „30 % Relaunch-Rabatt sichern".

---

### 4. Design

- Eigene Bulls-Token in `src/styles.css`: `--bulls-red`, `--bulls-black`, kombiniert mit bestehendem BodyFuel-Grün/Gold.
- Bulls-Bereich nutzt schwarzen Hintergrund, weiße Schrift, rote Akzente, grüne CTAs.
- Bestehender `AppLayout` bleibt, Bulls-Routen erhalten zusätzlich einen `BullsSection`-Wrapper mit Bulls-Theme (CSS-Variablen-Override in Container).
- Mobile-first, große Karten, klare Buttons.

---

### 5. Technische Details

- Server-Funktionen in `src/lib/bulls.functions.ts` (`getBullsProfile`, `upsertBullsProfile`, `logWeight`, `listWeights`, `trackHubEvent`, `getStarterScore`, `uploadProgressPhoto`, `listProgressPhotos`).
- Admin-Funktionen in `src/lib/admin-groups.functions.ts` (`setUserGroup`, `removeUserGroup`, `listUsersWithGroups`).
- Session (`src/lib/bodyfuel/session.tsx`) lädt zusätzlich `user_groups` und exposed `groups: string[]` + `hasGroup(g)`.
- Foto-Upload via Storage-Bucket `bulls-progress-photos` mit signierten URLs.
- Recharts für Gewichtsgraph (bereits im Stack).

---

### 6. Out of Scope

- Kein automatisches Challenge-Ranking (explizit ausgeschlossen).
- Keine Integration mit WhatsApp-Challenge.
- Keine medizinische Beratung / individuelle Pläne.
- Keine Push-Notifications / Email-Reminder in dieser Iteration.
