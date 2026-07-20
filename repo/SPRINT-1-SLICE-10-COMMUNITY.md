# Sprint 1 – Slice 10: Community & Challenges

## Ziel

Community-Feed, Challenge-Verwaltung und Punkte-Regeln aus der Organisationsroute auslagern und die dazugehörige Geschäftslogik testbar machen.

## Ergebnis

Die Route `src/routes/coach.teams.$orgId.tsx` wurde von 789 auf 487 Zeilen reduziert.

### Neue Komponenten

- `src/features/coach-org-detail/components/CommunityHub.tsx`
- `src/features/coach-org-detail/components/CommunityTab.tsx`
- `src/features/coach-org-detail/components/ChallengesTab.tsx`
- `src/features/coach-org-detail/components/ChallengeRuleEditor.tsx`

### Neue Hooks

- `src/features/coach-org-detail/hooks/useOrgCommunity.ts`
- `src/features/coach-org-detail/hooks/useOrgChallenges.ts`
- `src/features/coach-org-detail/hooks/useChallengeRules.ts`

### Neue Domain-Logik

- `src/features/coach-org-detail/lib/community.logic.ts`
- `src/features/coach-org-detail/lib/__tests__/community.logic.test.ts`

### Typen

`src/features/coach-org-detail/types.ts` wurde um typisierte Community-, Challenge-, Regel- und Formularmodelle ergänzt.

## Behobene Probleme

1. Geplante Challenges wurden vorher gleichzeitig als „aktiv“ und „geplant“ einsortiert. Die Zeitraumeinteilung ist jetzt eindeutig und wird getestet.
2. Der Community-Feed leitete den Organisations-Slug indirekt aus einem deaktivierten React-Query-Cache-Eintrag ab. Der Slug wird jetzt explizit aus der Route übergeben.
3. Formularwerte werden vor dem Serveraufruf normalisiert und validiert.
4. Fehlerzustände für Beiträge, Challenge-Erstellung, Punkte-Regeln und manuelle Boni sind sichtbar und bleiben im jeweiligen Flow erhalten.
5. Die neuen Feature-Dateien enthalten keine expliziten `any`-Typen.

## Prüfungen

- ESLint für alle neuen und geänderten Feature-Dateien: bestanden
- Neue Community-/Challenge-Tests: 6/6 bestanden
- Alle gezielten Regressionstests: 27/27 bestanden
- Route und lokale Imports per esbuild gebündelt: bestanden
- Vollständiger Produktionsbuild: nach 120 Sekunden abgebrochen; der Build erzeugt weiterhin eine sehr große Menge bestehender TanStack-`inputValidator()`-Deprecation-Warnungen
- Projektweiter TypeScript-Check: innerhalb des Zeitlimits nicht abgeschlossen

## Nächster sinnvoller Slice

Die verbleibenden ca. 487 Zeilen der Organisationsroute bestehen überwiegend aus Header, KPI-/Quick-Access-Aufbau, Overview und Tab-Orchestrierung. Als nächstes sollte die Route in einen `useCoachOrgDetail`-Controller und kleinere Layout-Komponenten zerlegt werden. Danach kann die Route selbst auf ungefähr 150–220 Zeilen sinken.
