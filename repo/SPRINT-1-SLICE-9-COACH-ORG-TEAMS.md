# Sprint 1 — Slice 9: Coach-Organisation Teams

## Ziel

Die Teamverwaltung und der Teamfilter werden aus der großen Organisationsroute in ein eigenes Feature-Modul verschoben. Die Route orchestriert nur noch Daten, Navigation und Tabs.

## Neu

- `components/TeamsTab.tsx`
- `components/TeamSwitcher.tsx`
- `hooks/useOrgTeams.ts`
- `lib/team.logic.ts`
- `lib/__tests__/team.logic.test.ts`

## Änderungen

- Team anlegen, validieren und Query-Invalidierung in `useOrgTeams`
- Teamkarten, Kennzahlen und Beitrittslink-Aktionen in `TeamsTab`
- Teamfilter-Navigation in `TeamSwitcher`
- Athleten-Scope als pure, testbare Domain-Logik
- `PerfKpi` in gemeinsame Org-Primitives verschoben
- ungenutzte `Stat`-Komponente entfernt
