import { ChallengeRuleEditor } from "@/features/coach-org-detail/components/ChallengeRuleEditor";
import { Empty } from "@/features/coach-org-detail/components/OrgDetailPrimitives";
import { useOrgChallenges } from "@/features/coach-org-detail/hooks/useOrgChallenges";
import type { OrgChallenge, OrgTeam } from "@/features/coach-org-detail/types";

export function ChallengesTab({ orgId, teams }: { orgId: string; teams: OrgTeam[] }) {
  const challenges = useOrgChallenges(orgId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Organisations-Challenges</h3>
        <button
          type="button"
          onClick={() => challenges.setShowCreateForm(!challenges.showCreateForm)}
          className="rounded bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
        >
          {challenges.showCreateForm ? "Abbrechen" : "+ Challenge erstellen"}
        </button>
      </div>

      {challenges.showCreateForm && (
        <>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-2 text-[11px] text-muted-foreground">
            Nach dem Speichern öffnet sich der Punkte-Editor. Ohne Punkte-Regeln fließt die
            Challenge nicht in die Rangliste.
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              challenges.submit();
            }}
            className="rounded-lg border border-border bg-card p-3 text-sm"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={challenges.draft.name}
                onChange={(event) => challenges.updateDraft({ name: event.target.value })}
                placeholder="Name"
                maxLength={120}
                className="rounded border border-border bg-background px-2 py-1"
              />
              <select
                value={challenges.draft.teamId}
                onChange={(event) => challenges.updateDraft({ teamId: event.target.value })}
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">Organisationsweit</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={challenges.draft.start}
                onChange={(event) => challenges.updateDraft({ start: event.target.value })}
                className="rounded border border-border bg-background px-2 py-1"
              />
              <input
                type="date"
                value={challenges.draft.end}
                min={challenges.draft.start}
                onChange={(event) => challenges.updateDraft({ end: event.target.value })}
                className="rounded border border-border bg-background px-2 py-1"
              />
              <textarea
                value={challenges.draft.description}
                onChange={(event) => challenges.updateDraft({ description: event.target.value })}
                placeholder="Beschreibung"
                rows={2}
                className="rounded border border-border bg-background px-2 py-1 sm:col-span-2"
              />
            </div>
            {challenges.error && (
              <div className="mt-2 text-xs text-red-500">{challenges.error}</div>
            )}
            <button
              type="submit"
              disabled={!challenges.draft.name.trim() || challenges.isCreating}
              className="mt-2 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {challenges.isCreating ? "Wird gespeichert…" : "Speichern"}
            </button>
          </form>
        </>
      )}

      {challenges.isLoading ? (
        <Empty>Challenges werden geladen…</Empty>
      ) : (
        <>
          <ChallengeSection
            title="Aktiv"
            items={challenges.groups.active}
            onSelect={challenges.setSelectedChallengeId}
          />
          <ChallengeSection
            title="Geplant"
            items={challenges.groups.planned}
            onSelect={challenges.setSelectedChallengeId}
          />
          <ChallengeSection
            title="Abgeschlossen"
            items={challenges.groups.past}
            onSelect={challenges.setSelectedChallengeId}
          />
        </>
      )}

      {challenges.selectedChallengeId && (
        <ChallengeRuleEditor
          challengeId={challenges.selectedChallengeId}
          onClose={() => challenges.setSelectedChallengeId(null)}
        />
      )}
    </div>
  );
}

function ChallengeSection({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: OrgChallenge[];
  onSelect: (challengeId: string) => void;
}) {
  return (
    <section>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {items.length === 0 ? (
        <Empty>Keine Einträge.</Empty>
      ) : (
        <ul className="space-y-2">
          {items.map((challenge) => {
            const hasNoRules = challenge.rule_count === 0;
            return (
              <li
                key={challenge.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
                  hasNoRules ? "border-amber-500/60 bg-amber-500/5" : "border-border bg-card"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{challenge.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {new Date(challenge.starts_at).toLocaleDateString("de-DE")}
                    {challenge.ends_at &&
                      ` – ${new Date(challenge.ends_at).toLocaleDateString("de-DE")}`}
                  </div>
                  {hasNoRules ? (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                      ⚠ Keine Punkte – fließt nicht in die Rangliste
                    </div>
                  ) : (
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {challenge.rule_count} Regel{challenge.rule_count === 1 ? "" : "n"}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(challenge.id)}
                  className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    hasNoRules ? "bg-amber-500 text-black" : "border border-border"
                  }`}
                >
                  Punkte
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
