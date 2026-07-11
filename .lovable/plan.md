## Ziel

BodyFuel Performance zu einer echten modularen Multi-Tenant-Plattform ausbauen — auf Basis der bereits vorhandenen `organizations` / `organization_features` / `staff_assignments` / `organization_memberships` Struktur. Keine Parallelsysteme. Bulls Hub bleibt unangetastet.

Weil die Anforderung sehr groß ist, schlage ich eine **schrittweise Umsetzung in 6 Phasen** vor. Jede Phase ist eigenständig deploybar. Wir starten mit dem Fundament (Phase 1+2). Weitere Phasen jeweils erst nach deinem OK.

---

## Aktueller Stand (Analyse)

Was bereits vorhanden ist und wiederverwendet wird:

- `organizations` (18 Spalten, inkl. `organization_type`, Branding-Felder, Slug)
- `organization_features` — die zentrale Modul-Toggle-Tabelle (`feature`, `enabled`)
- `ORG_MODULES` Katalog in `src/lib/organizations/modules.ts` — Single Source of Truth für Modul-Toggles
- `orgTerminology()` in `src/lib/organizations/org-type.ts` — erste dynamische Begriffe (Sportverein vs. Fitnessstudio)
- `staff_assignments` / `organization_memberships` / `user_roles` — bereits mandantenfähig, RLS via `has_role` und `coach_can_access_user`
- `OrgAthleteLayout` mit Feature-Gating pro Nav-Item
- Bulls-spezifisches Theme wird bereits über `.bulls-theme` Klasse gemappt (nicht hardcoded)

Was fehlt für Coaches / Studios / Unternehmen:

- `organization_type` kennt nur `sports_club` und `fitness_studio` — keine `solo_coach`, `coaching_company`, `company`, `custom`
- Modul-Katalog deckt nicht alle geforderten Module ab (Aufgaben, Coach-Chat, Körperdaten, Fortschrittsmessung, Dokumente, Onboarding, Profilbilder, Statistiken, Regeneration, Strength Tests, Rezepte, Einkaufsliste, Positionen, Spieltage, Trainingskalender als eigenständige Toggles)
- Keine Standard-Preset-Logik pro Organisationstyp
- Terminologie nur zwischen 2 Typen — nicht überschreibbar
- Keine Lizenz-/Plan-Felder (Kundenzahl-Limit, Coach-Zahl-Limit, Status, Trial)
- Kein Wizard „Neue Organisation erstellen“ mit Typ-Auswahl
- Coach-Kunden-Zuweisung existiert nur über `customer_packages` (BodyFuel-Coaching-spezifisch), nicht generalisiert pro Org

---

## Phase 1 — Fundament (dieser Schritt, wenn du zustimmst)

**Ziel:** Datenschicht + zentrale Konfiguration erweitern, ohne UI-Bruch.

### 1.1 Migration `organizations`

Neue Spalten (alle nullable / mit Default, damit bestehende Bulls-Zeile unberührt bleibt):

- `terminology jsonb` — überschreibbare Begriffe pro Org (`{ player: "Kunde", team: "Gruppe", ... }`)
- `branding_mode text` — `bodyfuel` | `powered_by` | `white_label` (default `bodyfuel`)
- `license_plan text` — `trial` | `starter` | `pro` | `unlimited` | `custom` (default `trial`)
- `license_status text` — `trial` | `active` | `payment_due` | `suspended` | `cancelled` (default `trial`)
- `license_started_at timestamptz`, `license_expires_at timestamptz`
- `max_customers int`, `max_coaches int` (nullable = unbegrenzt)

`organization_type` bekommt zusätzlich diese erlaubten Werte (nur Textspalte, kein Enum — keine Migration nötig für den Typ selbst):
`sports_club`, `solo_coach`, `coaching_company`, `fitness_studio`, `company`, `custom`.

### 1.2 Neue Zunftraum-Tabelle `organization_coach_assignments`

Für Coach-Kunden-Mapping in Coach-Orgs (mandantenfähig, unabhängig von `customer_packages`):

- `organization_id`, `coach_user_id`, `customer_user_id`
- `role` — `primary_coach` | `secondary_coach` | `nutrition_coach` | `training_coach` | `substitute`
- RLS: nur Coaches der Org sehen ihre Zuweisungen, `organization_owner`/`organization_admin` sieht alle der Org

### 1.3 Modul-Katalog erweitern (`src/lib/organizations/modules.ts`)

Neue Modul-Keys (Toggle-Only, kein Schema-Change nötig):

`tasks`, `coach_chat`, `body_metrics`, `progress_tracking`, `documents`, `onboarding`, `profile_photos`, `analytics`, `regeneration`, `strength_tests`, `recipes`, `shopping_list`, `positions`, `matchdays`, `training_calendar`, `smart_nutrition`, `smart_training` (letzte zwei getrennt von den Basis-Modulen).

Bestehende Keys (`nutrition`, `athletic_training`, `checkins`, `challenges`, `community`, `performance`, `gamification`, `injury_management`, `load_management`) bleiben.

### 1.4 Presets pro Organisationstyp

Neuer Helper `src/lib/organizations/org-presets.ts`:

- `DEFAULT_MODULES_BY_ORG_TYPE` — welche Module standardmäßig `enabled` sind
- `DEFAULT_TERMINOLOGY_BY_ORG_TYPE` — Basis-Begriffe für alle 6 Typen
- Wird beim Erstellen einer neuen Org angewendet, danach frei überschreibbar

### 1.5 `orgTerminology()` erweitern

Statt hardcoded 2 Typen: liest zuerst aus `organizations.terminology`, fällt zurück auf `DEFAULT_TERMINOLOGY_BY_ORG_TYPE[type]`. Rückwärtskompatibel — alle bestehenden Aufrufer bekommen dieselben Begriffe.

---

## Phase 2 — „Neue Organisation erstellen“ Wizard

Im Owner-Bereich (`/coach` bzw. Admin) ein 6-Schritt-Wizard:

1. Typ auswählen (6 Karten)
2. Grunddaten (Name, Ansprechpartner, E-Mail, Logo)
3. Preset-Module anzeigen
4. Module individuell togglen
5. Ersten Organisationsinhaber anlegen (bestehender Nutzer per E-Mail oder Einladung)
6. Bestätigen → leere Org anlegen, keine Bulls-Daten kopieren

Server-Fn `createOrganizationWithPreset` (bereits vorhandene `createOrganization` Fn erweitern, keine Duplikate).

---

## Phase 3 — Dynamische Terminologie in der UI

- Alle Stellen, die aktuell hart „Athlet“, „Spieler“, „Verein“, „Mannschaft“ verwenden, auf `orgTerminology(org)` umstellen — schrittweise pro Route.
- Admin-UI zur Überschreibung: neue Karte „Bezeichnungen“ im Org-Cockpit neben „Module“.

---

## Phase 4 — Rollen & Kundenzuweisung generalisieren

- Rolle `organization_owner` (bisher implizit über `staff_assignments.role='organization_admin'` + `manage_organization`) klar von `organization_admin` trennen; `coach` und `customer` als Org-lokale Rollen dokumentieren.
- UI im Org-Cockpit: „Coaches“ und „Kunden“ Tabs (dynamisch benannt via Terminologie), Kundenzuweisung über `organization_coach_assignments`.
- `coach_can_access_user` erweitern: Coach in Coach-Org sieht Kunden, die ihm über `organization_coach_assignments` zugewiesen sind — analog zur bestehenden Bulls-Logik.

---

## Phase 5 — Modul-Gating in Navigation vervollständigen

- Für jedes neue Modul ein `feature`-Gate in `OrgAthleteLayout` + Coach-Cockpit einbauen.
- Deaktivierte Module: kein Nav-Item, kein Dashboard-Widget, keine leeren Bereiche, kein CTA.

---

## Phase 6 — Branding-Erweiterung + Lizenz-UI (nur Vorbereitung)

- Branding-Felder erweitern (Sekundärfarbe, Akzentfarbe, Hintergrund, Login-Bild, Dashboard-Bild, App-Name, Begrüßungstext) — in Migration Phase 1 bereits als jsonb `branding_extra` vorbereiten oder als eigene Spalten.
- Lizenz-Statuschip im Admin (read-only) basierend auf `license_status`. Noch keine Stripe-Integration.

---

## Was NICHT in diesem Sprint passiert

- Keine Datenmigration bestehender Bulls-/Manu-Coaching-Daten
- Kein Stripe / echte Abrechnung
- Keine echte White-Label-Domain-Logik
- Bulls-spezifische Routen (`bulls.*`) bleiben unverändert — Bulls sind eine `sports_club`-Org mit voll gesetzten Modulen

---

## Vorschlag zum Vorgehen

Ich schlage vor, wir **starten jetzt konkret mit Phase 1** (Migration + Modul-Katalog + Presets + Terminologie-Helper). Das ist reine Fundamentarbeit, verändert nichts an bestehenden UIs, und ist Voraussetzung für alles Weitere.

**Bitte bestätige:**

1. Phase 1 jetzt starten? (Migration + Katalog + Presets, ~1 Migration + ~3 neue TS-Dateien, keine UI-Änderung)
2. Oder möchtest du zuerst Änderungen an der Phaseneinteilung?
3. Sollen die neuen Modul-Keys (`tasks`, `coach_chat`, ...) für bestehende Orgs (Bulls, Manu-Coaching) automatisch mit ihrem aktuellen Zustand vorbelegt werden (z. B. `tasks: true` für Bulls, weil dort bereits Aufgaben existieren)?