## BODYFUEL OS – Navigation Rework

Ziel: Reorganisation der Navigation auf 5 klare Hauptbereiche, **ohne** bestehende Daten, Routen oder Funktionen zu entfernen. Alle alten URLs bleiben weiter erreichbar (Deep-Links, Coach-Links, E-Mails funktionieren weiter). Nur die Sidebar/Bottom-Nav und die Hub-Seiten ändern sich.

### Neue Bottom-Nav (5 Einträge)
1. **Dashboard** → `/dashboard`
2. **Ernährung** → `/nutrition`
3. **Training** → `/training`
4. **Community** → `/community` *(neu)*
5. **Profil** → `/profile`

Bulls-Hub bleibt als zusätzlicher Eintrag erhalten (für Bulls-Mitglieder), zieht aber visuell unter Community ein.

### Was wir ändern

**`src/components/bodyfuel/AppLayout.tsx`**
- `clientNav` reduzieren auf die 5 Punkte oben.
- Bulls-Eintrag bleibt (Sidebar-Add-on), wird im Community-Hub zusätzlich verlinkt.
- Achievements / Ranking / Measurements werden aus der Nav entfernt, bleiben aber als Routen verfügbar und werden in Community bzw. Profil verlinkt.

**Neue Hub-Seiten (jede ist nur eine Übersicht mit Links auf bereits existierende Routen/Komponenten – keine Logik-Änderung):**

- `src/routes/community.tsx` *(neu)* – Sammelhub:
  - Ranking-Card → `/ranking` (Tabs: Gesamt / Woche / Streak / Level existieren bereits)
  - Bulls Hub → `/bulls` (nur sichtbar wenn `hasGroup("bulls")`)
  - Challenges → Platzhalter-Card „Bald verfügbar" (Feature existiert noch nicht – nicht erfinden)
  - Achievements → `/achievements`
  - Community-Profil-Card (Nickname/Level/Punkte/Streak aus Session)

- `src/routes/nutrition.tsx` umbauen zum Ernährungs-Hub mit Sektionen:
  - Tracking → `/nutrition/tracking`
  - Plan (aktiv/kommend/Archiv) → `/nutrition` Inhalte (bestehende `PlansView`/`PlanContentView`)
  - Einkaufsliste → `/nutrition/shopping`
  - Meal Prep → zeigt die aus dem Profil hinterlegte Präferenz nur an (read-only aus bestehendem Feld)
  - Favoriten → `/nutrition/favorites`
  - Rezept aus Zutaten → `/nutrition/recipe-from-ingredients`

- `src/routes/training.tsx` umbauen zum Trainings-Hub:
  - Trainingsplan (aktiv/kommend/Archiv) – bestehende `TrainingPlanManagementCard`
  - Freie Einheiten → bestehender `TrainingTracker` / `AddTrainingSessionDialog`
  - Strength Check → `/strength-check`
  - Trainingsanalyse → bestehende `TrainingTrends` / `ExerciseAnalytics`
  - Insights → bestehende Insights-Komponenten

- `src/routes/profile.tsx` erweitern zum Profil-Hub:
  - Fortschritt → `/progress`
  - Maße → `/measurements`
  - Fortschrittsfotos → `ProgressPhotosCard`
  - Check-ins → `/check-in`
  - Bewertungen → `CustomerCheckinsCard` / Coach-Reviews-Anzeige
  - Einstellungen (Account, Datenschutz, Nickname ändern, Profil bearbeiten)

- `src/routes/dashboard.tsx`: nur Aufräumen/Priorisieren der Widget-Reihenfolge (Tagespunkte, Kalorien, Protein, Schritte, aktueller Plan, nächste Aufgaben, Gewicht, Streak, Quick Actions). Keine Logik anfassen.

### Was wir NICHT ändern
- Keine DB-Migration. Keine Felder ändern.
- Keine `*.functions.ts` / `*.server.ts` werden umgeschrieben.
- Alle alten Routen (`/measurements`, `/ranking`, `/achievements`, `/progress`, `/check-in`, `/nutrition/*`, `/strength-check`, `/bulls*`, `/tracker/*`) bleiben 1:1 bestehen und funktionieren weiter.
- Coach-Bereich (`/coach/*`) bleibt unverändert.
- Free-Tracker-Layout (`FreeAppLayout`) bleibt unverändert.
- Challenges werden nur als „Coming Soon"-Platzhalter angezeigt (kein neues Feature gebaut).

### Technische Details
- Neue Route: nur `src/routes/community.tsx` (TanStack file-route `/community`).
- `routeTree.gen.ts` wird automatisch regeneriert.
- Hub-Seiten verwenden ausschließlich bestehende Komponenten + `<Link>`.
- Mobile Bottom-Nav: genau 5 Icons; Bulls erscheint nur in Desktop-Sidebar als Zusatz, in Mobile über den Community-Hub erreichbar.

### Reihenfolge
1. `AppLayout.tsx` Nav reduzieren, `community`-Eintrag aufnehmen.
2. `community.tsx` anlegen.
3. `nutrition.tsx`, `training.tsx`, `profile.tsx` zu Hubs erweitern (Inhalte hinzufügen, nichts entfernen).
4. `dashboard.tsx` Widget-Reihenfolge sortieren.