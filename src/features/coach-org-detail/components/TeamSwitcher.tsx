import type { OrgTeamDetail } from "@/features/coach-org-detail/types";

export function TeamSwitcher({
  teams,
  activeTeamId,
  onChange,
}: {
  teams: OrgTeamDetail[];
  activeTeamId: string | null;
  onChange: (teamId: string | null) => void;
}) {
  if (teams.length <= 1) return null;

  return (
    <div className="mt-3 flex gap-1.5 overflow-x-auto rounded-xl border border-[#252525] bg-[#0f0f0f] p-1 no-scrollbar">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
          !activeTeamId ? "bg-bulls-red text-white" : "text-neutral-400 hover:text-white"
        }`}
      >
        Alle
      </button>
      {teams.map((team) => (
        <button
          type="button"
          key={team.id}
          onClick={() => onChange(team.id)}
          className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
            activeTeamId === team.id
              ? "bg-bulls-red text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          {team.name}
        </button>
      ))}
    </div>
  );
}
