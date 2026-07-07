import { CheckSquare, MessageSquare, StickyNote } from "lucide-react";
import { toast } from "sonner";

export function AthleteQuickActions() {
  const notReady = () => toast.info("Kommt in Kürze — Coach-Actions werden im nächsten Schritt aktiviert.");
  return (
    <div className="grid grid-cols-3 gap-2">
      <QuickBtn icon={<CheckSquare className="h-3.5 w-3.5" />} label="Aufgabe" onClick={notReady} />
      <QuickBtn icon={<MessageSquare className="h-3.5 w-3.5" />} label="Nachricht" onClick={notReady} />
      <QuickBtn icon={<StickyNote className="h-3.5 w-3.5" />} label="Notiz" onClick={notReady} />
    </div>
  );
}

function QuickBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-muted/40"
    >
      {icon}
      {label}
    </button>
  );
}
