import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function CoachingUpsell() {
  return (
    <div className="rounded-2xl border border-bulls-red/50 bg-gradient-to-br from-black to-background p-6 shadow-bulls">
      <p className="text-xs uppercase tracking-[0.2em] text-bulls-red">Individuelles Coaching</p>
      <h3 className="mt-1 font-display text-xl font-bold">Du willst einen individuellen Plan?</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Mit BodyFuel Coaching erhältst du individuelle Kalorien & Makros, Training passend zu
        deiner Position und deinem Ziel, persönliche Anpassungen und Support direkt durch Manu.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/">
          <Button className="bg-gradient-gold text-primary-foreground">
            Individuelles Coaching anfragen
          </Button>
        </Link>
        <Link to="/">
          <Button variant="outline" className="border-bulls-red text-bulls-red hover:bg-bulls-red/10">
            30 % Relaunch-Rabatt sichern
          </Button>
        </Link>
      </div>
    </div>
  );
}
