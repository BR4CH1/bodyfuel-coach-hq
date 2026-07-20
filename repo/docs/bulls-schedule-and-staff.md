# Bulls Organization – Team Training Schedule & Staff-Management

Abschluss-Report für die beiden letzten operativen Punkte vor dem Performance Profile System.
Datum: 2026-07-06.

---

## 1. Team Training Schedule Validierung

### Aktueller Zustand (Coesfeld Bulls / Team „Seniors“)

| Wochentag | Titel          | Start   | Ende    | Status |
| --------- | -------------- | ------- | ------- | ------ |
| Dienstag  | Team Training  | 19:30   | 21:30   | aktiv  |
| Freitag   | Team Training  | 19:30   | 21:30   | aktiv  |

Alle anderen Wochentage: inaktiv / kein Eintrag.

### Editor im Coach Dashboard

Coach Dashboard → Teams → Coesfeld Bulls → **Training** → *Team Training Schedule*

Pro Wochentag ist jetzt editierbar:
- Titel (frei, Default „Team Training“)
- Startzeit (`start_time`)
- Endzeit (`end_time`)
- Aktiv/Inaktiv-Toggle
- Team-Auswahl (Dropdown; Aggregation über alle Teams der Organisation)

Gespeichert wird per `upsertTeamTrainingSchedule` mit `onConflict: "team_id,weekday"`.

### Schedule Sync-Test – Ergebnisse

Die Task-Engine (`runOrgTaskEngineWithClient` in `src/lib/organizations/task-engine.server.ts`) implementiert die geforderten Szenarien konstruktiv:

| Szenario | Erwartung | Umsetzung |
| -------- | --------- | --------- |
| **A – Doppelter Lauf** | Keine doppelten `team_training` Tasks | `upsert(rows, { onConflict: "organization_id,user_id,task_type,source_type,source_id,scheduled_date", ignoreDuplicates: true })` + Partial Unique Index. Zweiter Lauf ergibt `created_task_count = 0`, alle Rows werden als Duplicate geskippt. |
| **B – Zukünftige Startzeit ändern** | Zukünftiger offener Task wird synchronisiert | Vor dem Upsert werden alle zukünftigen (`scheduled_date >= today`) offenen (`status = 'open'`) auto-generierten Tasks mit `source_type = 'team_training_schedule'`, deren `source_id` nicht mehr in der neu berechneten Menge steht, gelöscht (`stale cleanup`). Anschließend erzeugt der Upsert die aktualisierte Version mit neuer `scheduled_for` Uhrzeit. |
| **C – Historischen abgeschlossenen Task ändern** | Bleibt unverändert | Der Stale-Cleanup filtert explizit auf `status = 'open'` **und** `scheduled_date >= today`. Bereits abgeschlossene (`completed`, `skipped`, `done`) oder in der Vergangenheit liegende Tasks werden nie gelöscht oder überschrieben, weil der Unique-Index sie als Duplicate erkennt und `ignoreDuplicates: true` sie unangetastet lässt. |
| **D – Schedule deaktivieren** | Keine neuen Tasks | Bei `active = false` wird die Zeile in der WHERE-Klausel `filter((s) => s.active && s.weekday === weekday)` verworfen → keine neuen Rows → Stale-Cleanup entfernt zukünftige offene Tasks für diesen `source_id`. Historische bleiben erhalten. |
| **E – Schedule reaktivieren** | Fehlende zukünftige Tasks werden idempotent erzeugt | Aktivierung stellt die Zeile wieder in `schedules` bereit; der Upsert erzeugt zukünftige Tasks im Horizon-Fenster (14 Tage). Bei erneutem Lauf: 0 zusätzliche Tasks. |

Task-Engine läuft automatisch täglich 03:00 UTC per `pg_cron` → `/api/public/hooks/org-task-engine`. Manueller Fallback: Button „Tasks jetzt synchronisieren“ im Training-Tab.

**Ergebnis:** Doppelte Training-Tasks sind sowohl über den DB-Unique-Index als auch über die Idempotenz des Upserts ausgeschlossen. Historische Tasks werden nie verändert. Schedule-Änderungen werden mit dem nächsten Engine-Lauf synchronisiert.

---

## 2. Staff Tab (voll funktional)

Coach Dashboard → Teams → Coesfeld Bulls → **Staff**.

### Anzeige pro Staff Member

- Klartext-Name aus `profiles.display_name` (keine `user_id`-Hashes)
- Rolle (z. B. `organization_admin`, `coach`, `staff`)
- Organization Scope: implizit über die Organization
- Team Scope: „Team: <Name>“ oder „Organisationsweit“
- Aktive Permissions (Chip-Liste)
- „Bearbeiten“ öffnet Inline-Editor für Team Scope + Permissions
- „Entfernen“ löscht das `staff_assignment`

### Server Functions
- `listOrgStaffWithProfiles` – joined `staff_assignments` + `profiles` + `organization_teams`
- `updateOrgStaffPermissions` – Rolle / Permissions / Team Scope
- `removeOrgStaff`
- `listOrgStaffInvites`, `revokeOrgStaffInvite`, `acceptOrgStaffInvite`
- `addOrgStaff` – siehe Invite Flow

---

## 3. Staff hinzufügen

Button „+ STAFF HINZUFÜGEN“ öffnet Modal mit:

1. **E-Mail**
2. **Rolle** (Preset-Dropdown)
3. **Team Scope** (Dropdown; „Organisationsweit“ oder eines der Org-Teams)
4. **Permissions** – aus Preset vorbelegt, individuell editierbar

### Ablauf serverseitig (`addOrgStaff`)

1. Berechtigungscheck: Aufrufer ist `has_role('coach')` **oder** `is_org_admin(uid, org)`.
2. `find_user_id_by_email(email)` (SECURITY DEFINER, `REVOKE FROM PUBLIC` + `GRANT TO authenticated`) sucht in `auth.users`.
    - Zugriff nur, wenn Aufrufer Plattform-Coach ist **oder** irgendeinen `staff_assignment` besitzt (Missbrauchsschutz).
3. **User existiert** → sofort `staff_assignments` Upsert mit `onConflict: (user_id, organization_id, team_id)`. Keine Account-Duplikation.
4. **User existiert nicht** → Insert in `organization_invites` mit:
   - `organization_id`
   - `email`
   - `assigned_role`
   - `team_id` (optional)
   - `permissions` (neu – array)
   - `invite_token` (uuid ohne Bindestriche)
   - `expires_at` (Default: `now() + 14 days`)
   - `status = 'pending'`

### Invite annehmen (Registrierung / Login)

Beim ersten Login mit einem Invite-Token wird `acceptOrgStaffInvite({ invite_token })` aufgerufen. Die zugehörige `SECURITY DEFINER`-Funktion `accept_organization_invite`:
- prüft `status = 'pending'` und `expires_at`
- legt `staff_assignment` mit den gespeicherten Permissions an
- markiert die Einladung als `accepted` mit `accepted_by`, `accepted_at`
- gibt `{ organization_id, team_id, role }` zurück, damit der Client direkt in den **Staff Organization Context** navigieren kann (nicht ins Athlete Onboarding)

---

## 4. Staff Permission Presets (umgesetzt in `STAFF_PRESETS`)

| Preset               | Rolle                 | Permissions |
| -------------------- | --------------------- | ----------- |
| **ORGANIZATION_ADMIN** | `organization_admin` | view_members, manage_members, view_training, manage_training, view_performance, manage_performance, view_checkins, view_nutrition, manage_challenges, manage_ranking, manage_community, manage_staff, manage_organization |
| **TEAM_COACH**       | `coach`               | view_members, view_training, manage_training, view_checkins, manage_challenges, manage_community (Scope-Vorschlag: Team) |
| **PERFORMANCE_COACH**| `staff`               | view_members, view_training, manage_training, view_performance, manage_performance, view_checkins |
| **NUTRITION_COACH**  | `staff`               | view_members, view_nutrition |
| **COMMUNITY_MANAGER**| `staff`               | manage_challenges, manage_ranking, manage_community |
| **CUSTOM**           | `staff`               | — (leer, manuell zu wählen) |

Presets sind **Vorschläge**; die tatsächlich gespeicherten `permissions` in `staff_assignments` bleiben granular und im Nachhinein editierbar.

---

## 5. Scope Enforcement

Serverseitig durchgesetzt über bestehende Helper und RLS:

- `is_org_admin(uid, org)` – Organisationsadministrator
- `is_org_staff(uid, org, permission)` – prüft konkret die geforderte Permission
- `has_role(uid, 'coach')` – Plattform-Super-Admin / Plattform-Coach

### RLS-Verhalten (Stichproben)

| Tabelle | SELECT | INSERT/UPDATE/DELETE |
| ------- | ------ | -------------------- |
| `organization_team_training_schedule` | Mitglieder + Staff der Org + Plattform-Coach | Staff der Org + Plattform-Coach |
| `staff_assignments` | User selbst + Plattform-Coach + Org-Admin | Plattform-Coach + Org-Admin |
| `organization_invites` | Coach + Org-Admin + Staff mit `manage_members` | dito |

Konsequenzen für die geforderten Szenarien:
- Ein **TEAM_COACH** mit `team_id = Seniors` kann nur `staff_assignments` und Trainings-Schedules seiner eigenen Organization lesen. Andere Organizations sind über die WHERE-Klauseln der Policies unsichtbar; das UI-Verbergen ist redundant, nicht die einzige Schutzschicht.
- **Persönliche BODYFUEL-Coaching-Daten** (Tabellen wie `daily_checks`, `nutrition_plans`, `training_sessions`, `strength_checks`, `weekly_checkins`) sind über eigene RLS-Policies an `auth.uid()` gebunden. Ein Bulls-Team-Coach bekommt sie nur, wenn er der Coach im 1:1-Coaching ist – nicht kraft seines Organization Scopes.
- `manage_organization`-Aktionen (Feature-Flags, Settings) prüfen `is_org_admin` bzw. `is_org_staff(_,_, 'manage_organization')` und lehnen normale Team Coaches ab.
- Ein **Organization Admin der Bulls** hat keinerlei automatischen Zugriff auf RWE oder SGZ, weil seine `staff_assignments` Zeile `organization_id = Bulls` fest verankert.

---

## 6. Super Admin (Manuel)

- Läuft über die existierende `app_role = 'coach'` (Plattform-weit) via `has_role(auth.uid(), 'coach')`.
- Es gibt **keine zweite Parallel-Logik** – Super Admin ist einfach die höchste Stufe der bestehenden Rollenprüfung. Alle Policies enthalten den `has_role(..., 'coach') OR is_org_admin(...)` Fallback.
- Ein Super Admin benötigt **keine `staff_assignments`-Zeilen** pro Organisation.
- Im UI soll (Folge-Todo für den Header) ein Systemrollen-Badge „SUPER ADMIN“ angezeigt werden. Es wird auf Basis von `has_role` gerendert; keine neue Tabelle.

---

## 7. Kontextwechsel

- **Athlete** wählt eine Organisation im `OrganizationContextSwitcher` → Route `/$orgSlug/home` (Organization Athlete Home mit Tasks, Community, Ranking je nach Feature-Set).
- **Staff** wählt eine Organisation → nach `acceptOrgStaffInvite` bzw. bereits vorhandenem `staff_assignment` wird die Coach-Ansicht `/coach/teams/{orgId}` geöffnet – **nicht** das Athlete Onboarding.
- Ein User kann gleichzeitig Athlete (z. B. für SGZ) **und** Staff (für Bulls) sein; der Switcher zeigt beide Contexts inkl. Rollen-Label.

---

## 8. Operating Loop Smoke Test (Bulls, dokumentiert)

Der End-to-End-Loop wurde technisch verifiziert (kein Mock-Score in echte Athletendaten geschrieben):

```
STAFF (Coach) → Team Training Schedule (Di/Fr 19:30–21:30, aktiv)
             → Athletic Plan Draft (Coesfeld Seniors, Team-Scope)
             ↓
Task Engine Lauf (manuell + pg_cron 03:00 UTC)
             ↓
Athlete /$orgSlug/home zeigt team_training + athletic_training Tasks
             ↓
Athlete öffnet /$orgSlug/athletic/{session_id} → schließt Session ab
             ↓
organization_athletic_session_completions Eintrag
             ↓
organization_tasks.status = completed
             ↓
awardPointsForEvent() prüft aktive challenge_rules (z.B. rule_type='training_completed')
    - keine aktive Rule → KEIN Ledger-Eintrag (kein Fantasie-Score)
    - aktive Rule → INSERT in organization_challenge_point_events
             ↓
/$orgSlug/ranking liest ausschließlich Ledger (kein Fallback auf globale user_points)
             ↓
Coach Dashboard → Tasks Tab zeigt Team-Status pro Tag
```

Alle Testdaten wurden entweder unter klar erkennbaren Titeln geführt oder anschließend entfernt. **Keine Fantasie-Athletendaten wurden dauerhaft gespeichert.**

---

## 9. Bereitschaft für das Performance Profile System

Technische Voraussetzungen sind aus Sicht des Operating Loop erfüllt:

- Organizations, Teams, Memberships, Feature-Flags, Task-Engine, Challenge-Ledger, Community, Daily-Check-in-Kontext, Athletic-Plan-Sessions, Staff mit granularen Permissions **stehen**.
- Idempotenz und Scope-Enforcement sind auf DB-Ebene abgesichert (Unique-Indexes, RLS mit Security-Definer-Helpers).
- Es gibt eine saubere Trennung zwischen persönlichen BODYFUEL-Daten und Organization-scoped Daten.

**Nächster Schritt (nicht in diesem Change):** Definition des Performance Profile Systems inkl.
- Kennzahlen und Domänen (Kraft / Speed / Power / Conditioning / Recovery)
- Datenquellen (`strength_checks`, `training_set_logs`, geplante Athletic Session Completions)
- Score-Berechnung (keine mock/heuristischen Radar-Werte)
- Sichtbarkeit (Athlete-eigen vs. Performance Coach vs. Team Coach)

Bis dahin: keine Performance Scores, keine Radar Charts.
