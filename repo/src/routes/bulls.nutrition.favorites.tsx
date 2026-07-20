import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { NutritionFavoritesContent } from "./nutrition.favorites";

export const Route = createFileRoute("/bulls/nutrition/favorites")({
  head: () => ({ meta: [{ title: "Favoriten — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <div className="space-y-5">
          <Link
            to="/bulls/nutrition"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red"
          >
            <ArrowLeft className="h-3 w-3" /> Ernährung
          </Link>
          <BullsHero
            eyebrow="Ernährung"
            title="Favoriten"
            subtitle="Gespeicherte Rezepte und Bewertungen — im Bulls Hub."
          />
          <NutritionFavoritesContent backTo="/bulls/nutrition" />
        </div>
      </BullsGate>
    </AppLayout>
  ),
});