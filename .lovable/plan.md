# BodyFuel Smart + Tarif-Vereinfachung

Großes Vorhaben — zwei eng verknüpfte Stränge. Ich schlage vor, in **3 Phasen** zu liefern, damit du nach jeder Phase Feedback geben kannst, bevor wir weiterbauen. Jede Phase ist für sich nutzbar.

## Leitplanken (gelten überall)

- Bestehende Coaching-Kunden, Pläne, Preise, Historien **unverändert**.
- Datenbank: nur **additive** Migrationen (neue Spalten/Tabellen, keine Drops, keine destruktiven Defaults).
- Free- und Trial-Nutzer bleiben unverändert; nur neue Upgrade-Pfade hinzu.
- Frontend spricht von **"BodyFuel Autopilot"**, nie von "KI".
- Coach-Preisflexibilität (`customer_packages.price_eur` etc.) bleibt erhalten.

---

## Phase 1 — Tarif-Vereinfachung & Bestandskunden-Umbenennung

Reine Aufräum- und Umbenennungs-Phase. Risiko niedrig, kein neuer Bezahlfluss.

1. **Paket-Konstanten** (`src/lib/bodyfuel/packages.ts`):
   - Aktive Pakete neu: `smart` (14,99 €) und `coaching` (69 € Standard).
   - `starter` / `premium` bleiben als Typen erhalten (Bestandsschutz), werden aber als `legacy: true` markiert und in keiner neuen UI mehr angezeigt.
2. **Migration** (additiv):
   - `customer_packages.package` erlaubt zusätzlich `'smart'`.
   - Bestehende `'coaching'`/`'premium'`/`'starter'`-Zeilen **bleiben wie sie sind** (keine UPDATE-Statements).
   - Anzeige-Label-Mapping: alte Werte werden im UI weiterhin sauber gerendert ("BodyFuel Coaching" / Legacy-Badge bei starter/premium nur im Coach-Dashboard).
3. **UI-Stellen**, an denen die neue 2-Tarif-Welt gezeigt wird:
   - Öffentliche Preis-/Pakete-Sektion auf der Landing
   - `MyPackagePanel` Labels
   - Coach-Kundenanlage: nur noch `smart` / `coaching` wählbar (Legacy lesbar, nicht neu vergebbar)

---

## Phase 2 — `/smart` Landingpage + Self-Service Registrierung + Smart-Onboarding + Autopilot-Generierung

Das Kernstück. Damit kann ein wildfremder Besucher ohne dich starten.

### 2a. Landingpage `/smart`
- Neue Route `src/routes/smart.tsx` (öffentlich, SSR, eigene `head()` mit Title/Description/OG).
- Sektionen: Hero, "Was ist Autopilot", Funktionsliste, Vorher/Nachher-Vergleich Smart vs. Coaching, Preis 14,99 €, FAQ, CTA "Jetzt starten".
- CTA führt zu `/auth?intent=smart-signup` (Registrierung) und nach Anmeldung direkt zu `/onboarding/smart`.

### 2b. Bezahlung
- Smart-Kauf wird über den **bestehenden** Zahlungs-Flow abgebildet (PayPal-Link wie bei Coaching, `customer_packages` mit `package='smart'`, 30 Tage Laufzeit).
- Kein neuer Payment-Provider in dieser Phase. Falls du echten Self-Service-Checkout willst, machen wir das in Phase 3 als separates Stripe/Paddle-Setup.

### 2c. Smart-Onboarding (`/onboarding/smart`)
Pflicht-Wizard, baut auf bestehendem `smart_nutrition_profile` + `athlete_profile` auf, ergänzt fehlende Felder:
- Persönlich: Alter, Geschlecht, Größe, Gewicht, Zielgewicht *(bestehend)*
- Ziel: Abnehmen / Muskelaufbau / Performance / Recomposition
- Trainingserfahrung: Anfänger / Fortgeschritten / Experte
- Trainingsort: Studio / Home Gym / Zuhause
- Geräte: Geräte / Freihanteln / Beides *(zusätzlich zur bestehenden `kitchen_equipment`-Logik kommt `training_equipment`)*
- Trainingstage (Mo–So) *(bestehend `training_weekdays`)*
- Trainingsdauer: 30/45/60/90 Min
- Ernährungsstil: Meal Prep / Frisch kochen / Gemischt → bei Meal Prep: 2/3/4/5/Woche Tage
- Einkauf: Täglich / 2T / 3T / Wöchentlich / Individuell *(bestehend `shopping_days`/`shopping_lead_days`)*
- Budget: Sparsam / Normal / Premium + optional EUR *(bestehend `budget_band` + `weekly_budget_eur`)*
- Abwechslung: Wenig / Mittel / Hoch *(neu: `variety_level`)*
- Lebensmittel: Mag / Mag nicht / Allergien / Unverträglichkeiten *(bestehend, erweitert um Unverträglichkeiten)*

### 2d. Autopilot-Generierung (server-side, beim Abschluss-Klick)
Sequenziell triggern wir vorhandene Funktionen, ohne Coach-Freigabe:
- `nutrition-plan-ai` → Ernährungsplan
- `training-plan-ai` → Trainingsplan
- `shopping-list-engine` → Einkaufsliste
- `nutrition_targets` setzen (Kalorien, Makros) aus Athletenprofil
- Zielprognose über bestehendes `goalProjection`
- Strength Check Eintrag erstellen (leer, ready)
- Fortschrittsfahrplan = sichtbare Roadmap aus den vorhandenen Daten

Wichtig: alles, was heute den Coach-Approve braucht, bekommt für `package='smart'` einen `auto_publish=true`-Pfad. Coach-Eingriff bleibt **möglich**, aber nicht nötig.

---

## Phase 3 — Upgrade-Pfade + Coach-Dashboard-Kennzahlen

### 3a. Upgrade-Komponente
Wiederverwendbare `UpgradeCard` mit kontextueller Zielauswahl:
- Free → Smart / Coaching
- Trial → Smart / Coaching (bei Trial-Ablauf prominent)
- Smart → Coaching
Eingebaut in: Dashboard, Profil, Einstellungen, Trial-Ablaufseite, Free-Bereich.

### 3b. Tracking
Neue Tabelle `upgrade_events` (user_id, from_tier, to_tier, event: 'click'|'started'|'completed', created_at). RLS: User schreibt eigene, Coach liest alles.

### 3c. Coach Dashboard Kennzahlen
Neue Card `TierMetricsCard`:
- Free / Trial / Smart / Coaching aktive Nutzer
- Upgrade-Klicks letzte 7/30 Tage
- Conversion: Trial→Smart, Trial→Coaching, Free→Smart, Free→Coaching, Smart→Coaching

---

## Was ich **nicht** anfasse

- Bestehende `nutrition_plans`, `training_sessions`, `customer_packages` Daten.
- Coach-Workflows für bestehende Coaching-Kunden (Tasks-Inbox, Radar, Chat — bleiben wie zuletzt gebaut).
- Punkte-/Level-/Ranking-/Achievements-Logik.

## Offene Fragen, bevor ich starte

1. **Bezahlung Smart**: Reicht es vorerst, denselben PayPal-Flow wie bei Coaching zu nutzen (du bestätigst Zahlung manuell, Smart wird aktiv) — oder soll ich Stripe-Self-Service-Checkout in Phase 2 mit aufnehmen?
2. **Smart-Onboarding-Position**: Direkt nach erfolgreicher Registrierung erzwungen (Hard-Gate, kein Dashboard ohne abgeschlossenes Onboarding) — ok?
3. **Sollen Bestandskunden auf `starter`/`premium` im Coach-UI zu `coaching` umgelabelt werden (rein Anzeige), oder Legacy-Bezeichnung behalten?**
4. **Reihenfolge**: Soll ich genau in der Phasen-Reihenfolge 1 → 2 → 3 liefern, oder zuerst die Landingpage `/smart` (Phase 2a) damit du schon Traffic drauf schicken kannst?

Sag mir die 4 Antworten — dann lege ich mit Phase 1 los.
