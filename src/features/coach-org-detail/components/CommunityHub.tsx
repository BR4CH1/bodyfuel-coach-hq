import { useEffect, useState } from "react";
import { ChallengesTab } from "@/features/coach-org-detail/components/ChallengesTab";
import { CommunityTab } from "@/features/coach-org-detail/components/CommunityTab";
import { Empty } from "@/features/coach-org-detail/components/OrgDetailPrimitives";
import type { CommunitySubTab, OrgTeam } from "@/features/coach-org-detail/types";

const SUB_TABS: Array<{ key: CommunitySubTab; label: string }> = [
  { key: "feed", label: "Feed" },
  { key: "challenges", label: "Challenges" },
  { key: "ranking", label: "Ranking" },
];

export function CommunityHub({
  orgId,
  orgSlug,
  teams,
  initialSubTab,
}: {
  orgId: string;
  orgSlug: string;
  teams: OrgTeam[];
  initialSubTab: CommunitySubTab;
}) {
  const [subTab, setSubTab] = useState<CommunitySubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {SUB_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSubTab(item.key)}
            className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
              subTab === item.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {subTab === "feed" && <CommunityTab orgId={orgId} orgSlug={orgSlug} />}
      {subTab === "challenges" && <ChallengesTab orgId={orgId} teams={teams} />}
      {subTab === "ranking" && (
        <Empty>
          Das Ranking basiert auf Punkten aus aktiven Organisations-Challenges. Ohne aktive
          Challenge oder Punkte-Ereignisse bleibt es leer.
        </Empty>
      )}
    </div>
  );
}
