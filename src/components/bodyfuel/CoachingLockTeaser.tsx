import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

type Props = {
  title?: string;
  features: string[];
  className?: string;
};

/**
 * Dezenter Upsell für Coaching-Features. Bewusst zurückhaltend gestaltet —
 * kleine ausgegraute Karte mit Schloss, kein aufdringliches Banner.
 */
export function CoachingLockTeaser({
  title = "Mit Coaching freischalten",
  features,
  className,
}: Props) {
  return (
    <Link
      to="/profile"
      className={`group block rounded-2xl border border-dashed border-border bg-card/40 p-4 transition hover:border-primary/40 hover:bg-card/60 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/60">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <span className="text-[10px] uppercase tracking-wider text-primary opacity-0 transition group-hover:opacity-100">
              Mehr →
            </span>
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {features.map((f) => (
              <li key={f} className="before:mr-1 before:content-['•']">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Link>
  );
}
