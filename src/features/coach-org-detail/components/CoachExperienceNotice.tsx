import { Activity } from "lucide-react";

export function CoachExperienceNotice({ hint }: { hint: string }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}
