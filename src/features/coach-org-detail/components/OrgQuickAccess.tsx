import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Dumbbell,
  Gauge,
  MessagesSquare,
  Palette,
  Settings,
  Type as TypeIcon,
  UserCog,
  Users,
  Users2,
  UsersRound,
} from "lucide-react";
import type { OrgTerminology } from "@/lib/organizations/org-type";
import type { CoachOrgTab } from "@/features/coach-org-detail/lib/org-detail.logic";

type QuickAccessItem = {
  key: CoachOrgTab;
  label: string;
  icon: LucideIcon;
};

export function OrgQuickAccess({
  tab,
  selectTab,
  terminology,
  featureOn,
  showCoachAssignments,
}: {
  tab: CoachOrgTab;
  selectTab: (tab: CoachOrgTab) => void;
  terminology: OrgTerminology;
  featureOn: (key: string) => boolean;
  showCoachAssignments: boolean;
}) {
  const items = buildQuickAccessItems({
    terminology,
    featureOn,
    showCoachAssignments,
  });

  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">
          Schnellzugriff
        </h2>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-2.5 lg:grid-cols-8">
        {items.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              className={`group flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all duration-150 active:scale-[0.97] ${
                active
                  ? "border-bulls-red bg-bulls-red/10 shadow-[0_0_0_1px_rgba(220,38,38,0.35)]"
                  : "border-[#252525] bg-[#111111] hover:-translate-y-0.5 hover:border-bulls-red/50 hover:bg-[#161616]"
              }`}
            >
              <Icon
                className={`h-6 w-6 transition-colors ${
                  active ? "text-bulls-red" : "text-bulls-red/80 group-hover:text-bulls-red"
                }`}
              />
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  active ? "text-white" : "text-neutral-300 group-hover:text-white"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function buildQuickAccessItems({
  terminology,
  featureOn,
  showCoachAssignments,
}: {
  terminology: OrgTerminology;
  featureOn: (key: string) => boolean;
  showCoachAssignments: boolean;
}): QuickAccessItem[] {
  const trainingEnabled =
    featureOn("athletic_training") || featureOn("training") || featureOn("smart_training");

  return [
    { key: "athletes", label: terminology.athletes, icon: Users },
    { key: "teams", label: terminology.teams, icon: Users2 },
    ...(trainingEnabled
      ? ([{ key: "training", label: "Training", icon: Dumbbell }] satisfies QuickAccessItem[])
      : []),
    ...(featureOn("load_management")
      ? ([{ key: "load", label: "Belastung", icon: Gauge }] satisfies QuickAccessItem[])
      : []),
    { key: "tasks", label: "Aufgaben", icon: ClipboardList },
    ...(featureOn("community")
      ? ([
          { key: "community", label: "Community", icon: MessagesSquare },
        ] satisfies QuickAccessItem[])
      : []),
    { key: "staff", label: "Staff", icon: UserCog },
    ...(showCoachAssignments
      ? ([
          {
            key: "coaches",
            label: `${terminology.coaches} & ${terminology.players}`,
            icon: UsersRound,
          },
        ] satisfies QuickAccessItem[])
      : []),
    { key: "naming", label: "Bezeichnungen", icon: TypeIcon },
    { key: "brand", label: "Branding", icon: Palette },
    { key: "modules", label: "Module", icon: Settings },
  ];
}
