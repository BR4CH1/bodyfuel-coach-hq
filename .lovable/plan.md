## Ziel

BodyFuel Performance zu einer echten modularen Multi-Tenant-Plattform ausbauen — auf Basis der bereits vorhandenen `organizations` / `organization_features` / `staff_assignments` / `organization_memberships` Struktur. Keine Parallelsysteme. Bulls Hub bleibt unangetastet.

---

## Umsetzungsstatus

- ✅ **Phase 1** — Fundament: Migrationen für neue Spalten (`terminology`, `branding_*`, `license_*`, `max_customers`, `max_coaches`, Enum-Erweiterung `organization_type`), Tabelle `organization_coach_assignments`, Modul-Katalog & Presets.
- ✅ **Phase 2** — 4-Step-Wizard „Neue Organisation erstellen" (Typ → Basics → Branding → Module → Lizenz), server-side Owner-Anlage.
- ✅ **Phase 3** — Dynamische Terminologie (`orgTerminology(orgType, overrides)`), Admin-UI `OrgTerminologyTab` mit 10 überschreibbaren Feldern, Live-Anzeige der Typ-Defaults, gespeichert in `organizations.terminology`.
- ✅ **Phase 4** — `organization_coach_assignments` inkl. Server-Fns (`listOrgCoachAssignments`, `upsertOrgCoachAssignment`, `removeOrgCoachAssignment`, `listOrgCoachesAndCustomers`) und `CoachAssignmentsTab` im Org-Cockpit (nur für Coach-Org-Typen sichtbar). RLS über bestehende Policies der Tabelle.
- ✅ **Phase 5** — `OrgAthleteLayout` gated jetzt zusätzlich `checkins`, `performance`, `ranking`, `nutrition`; Nav-Labels folgen `orgTerminology` (Community → Feed bei Unternehmen).
- ✅ **Phase 6** — `OrgLicenseChip` (read-only Plan/Status/Limits im Header), `OrgBrandingTab` (Farben, Logos, Kurzname, Claim, Branding-Modus `bodyfuel`/`powered_by`/`white_label`, `branding_extra` für Login-Bild, Dashboard-Bild, App-Name, Welcome-Text).

---

## Neue Dateien

- `src/lib/organizations/org-presets.ts` — Modul-Presets + License-Defaults pro Typ
- `src/components/organizations/OrgLicenseChip.tsx`
- `src/components/organizations/OrgTerminologyTab.tsx`
- `src/components/organizations/OrgBrandingTab.tsx`
- `src/components/organizations/CoachAssignmentsTab.tsx`

## Erweiterte Dateien

- `src/lib/organizations/organizations.functions.ts` — Terminology-/Branding-/Coach-Assignment-Server-Fns
- `src/lib/organizations/athlete.functions.ts` — `getOrgCoachDetail` liefert erweiterte Org-Felder
- `src/components/organizations/OrgAthleteLayout.tsx` — mehr Nav-Items + Terminologie
- `src/routes/coach.teams.$orgId.tsx` — neue Tabs `naming`, `brand`, `coaches`; License-Chip im Header; dynamische Labels

---

## Was NICHT umgesetzt wurde (bewusst)

- Keine Stripe-Integration / echte Abrechnung
- Keine Datenmigration bestehender Bulls-/Manu-Coaching-Daten (nur Modul-Backfill lief in Phase 1)
- Keine White-Label-Domain-Logik
- Bulls-spezifische Routen (`bulls.*`) bleiben unverändert — Bulls sind eine `sports_club`-Org mit voll gesetzten Modulen
- `assertCanManageOrg`-Guard in Branding/Terminology-Fns blockt Bulls hart (`assertNotBulls`)
