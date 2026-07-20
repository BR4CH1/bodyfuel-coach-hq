import { Card, Empty } from "@/features/coach-org-detail/components/OrgDetailPrimitives";
import type { OrgActivity, OrgChallengeSummary } from "@/features/coach-org-detail/types";

export function OrgOverviewTab({
  activeChallenge,
  pendingOnboardings,
  activity,
}: {
  activeChallenge: OrgChallengeSummary | null;
  pendingOnboardings: number;
  activity: OrgActivity[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Aktuelle Challenge">
        {activeChallenge ? (
          <div>
            <div className="font-display text-lg font-bold">{activeChallenge.name}</div>
            {activeChallenge.ends_at && (
              <div className="mt-1 text-xs text-muted-foreground">
                bis {new Date(activeChallenge.ends_at).toLocaleDateString("de-DE")}
              </div>
            )}
          </div>
        ) : (
          <Empty>
            Keine aktive Challenge. Historie ist derzeit leer — noch keine echten Challenge-Punkte
            im neuen Org-System.
          </Empty>
        )}
      </Card>
      <Card title="Offene Athlete Onboardings">
        <div className="font-display text-3xl font-bold">{pendingOnboardings}</div>
        <div className="text-xs text-muted-foreground">Athleten mit unvollständigem Onboarding</div>
      </Card>
      <div className="md:col-span-2">
        <Card title="Letzte Aktivitäten">
          {activity.length === 0 ? (
            <Empty>Noch keine Aktivitäten erfasst.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {activity.map((entry) => (
                <li key={entry.id} className="flex justify-between border-b border-border py-1">
                  <span>{entry.event_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("de-DE")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
