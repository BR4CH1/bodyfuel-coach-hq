import logoAsset from "@/assets/bodyfuel-logo.png.asset.json";

export function Logo({
  compact = false,
  showTagline = false,
}: {
  compact?: boolean;
  showTagline?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white shadow-gold">
        <img src={logoAsset.url} alt="BodyFuel Coaching" className="h-9 w-9 object-contain" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-base font-bold tracking-wider text-foreground">
            BODYFUEL
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Coaching
          </div>
          {showTagline && (
            <>
              <div className="mt-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-gold">
                <span>Nutrition</span>
                <span className="text-gold/50">•</span>
                <span>Training</span>
                <span className="text-gold/50">•</span>
                <span>Mindset</span>
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                No excuses. Just work.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
