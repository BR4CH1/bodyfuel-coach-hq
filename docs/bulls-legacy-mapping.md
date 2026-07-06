# Bulls Legacy Data Mapping

Stand: Juli 2026. Diese Analyse dokumentiert, wie mit den Bulls-Legacy-Objekten
im Kontext des neuen generischen Organization-Systems umgegangen wird. Es findet
in dieser Phase **keine** destruktive Migration statt.

## Klassifikation

| Legacy-Objekt | Zeilenanzahl (live) | User-Bezug | Klassifikation | Neues Zielmodell | Empfehlung |
|---|---|---|---|---|---|
| `bulls_profiles.weight_kg`, `height_cm` | 4 | `user_id` | Persönliche BODYFUEL-Daten | `profiles` / persönliche Metriken | **Bleibt persönlich.** Beim Org-Onboarding nur lesen und vorbelegen, nicht in Org-Tabellen kopieren. |
| `bulls_profiles.position`, `main_goal`, `onboarded_at` | 4 | `user_id` | Organization-Daten | `team_memberships.position` / `team_memberships.personal_goal`, `organization_memberships.onboarding_completed` | Bridge: Onboarding-Route bevorzugt bestehende Werte und spiegelt in `team_memberships`. `bulls_profiles` bleibt read-only bestehen. |
| `bulls_weight_logs` | 2 | `user_id` | **Persönliche BODYFUEL-Daten** | — | Bleibt vollständig persönlich. **Nicht** in Org-Sichten/Coach-Bulls-Dashboard sichtbar machen. Kein automatischer Zugriff für Staff. |
| `bulls_progress_photos` | 0 | `user_id` | Persönliche BODYFUEL-Daten | — | Bleibt persönlich. |
| `bulls_hub_events` | 13 | `user_id` + `kind` | Analytics/Events (persönlich) | `organization_activity_log` (nur neue Events) | Keine Kopie. Optionaler read-through-Join zur Anzeige alter Events im Coach-Dashboard möglich. Neue Events landen ausschließlich in `organization_activity_log`. |
| `bulls.*` Legacy-Routen (`training`, `nutrition`, `weight`, `photos`, `recovery`, `benchmarks`) | — | — | UI | `/$orgSlug/*` (neu) | Bleiben parallel bestehen, kein Löschen in dieser Phase. |
| `performance_points` | 96 (5 von 10 Bulls-Usern betroffen) | `user_id` | **Globale BODYFUEL-Smart-Punkte** (`pr_volume`, `pr_weight`, `pr_e1rm`, `strength_check_done`, `streak_7`) | — | **Kein** Bulls-Ranking daraus ableiten. Bleiben persönliche Smart-Metrik. |
| `user_points` | 29 (18 mit `daily_points>0`) | `user_id` | Globale Community/Smart-Punkte | — | Bleibt persönliches Punktesystem. Nicht in Org-Rankings mischen. |

## Bulls Challenge-Historie

Live-Prüfung ergab: Es existiert **keine dedizierte Bulls-Challenge- oder
Ranking-Tabelle**. Die Vermutung einer "verlorenen echten Bulls-Punktehistorie"
lässt sich datenseitig nicht bestätigen. Alle heute vorhandenen Punkte
(`performance_points`, `user_points`) sind globale BODYFUEL-Metriken und dürfen
nicht als Org-Ranking uminterpretiert werden.

Konsequenz: `organization_challenges` / `organization_challenge_progress` starten
bewusst leer. `/bulls/ranking` zeigt die Org-Rangliste; solange keine Bulls-
Challenge aktiv ist, ist die Liste leer — kein Fehler, kein Datenverlust.

## Datenhoheit

- Persönliche Athletendaten (Gewicht, Fotos, individuelle Ernährungspläne,
  persönliche Trainingspläne, Smart-Punkte) bleiben Eigentum des Users und
  werden **nicht** über Organization-Views/Staff-Rollen freigegeben.
- Organization-Daten (Team, Position, Trikotnummer, verfügbare Trainingstage,
  Athletic Plans, Tasks, Challenges, Team-Trainingsplan) leben in den neuen
  `organization_*` Tabellen und werden sichtbar für Organization-Members und
  Staff mit Scope.
