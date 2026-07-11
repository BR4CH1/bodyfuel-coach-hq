import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsRankingContent } from "@/components/bodyfuel/BullsRankingContent";

export const Route = createFileRoute("/bulls/ranking")({
  head: () => ({
    meta: [
      { title: "Rangliste — Bulls Hub" },
      {
        name: "description",
        content:
          "Bulls-Monatsrangliste: BodyFuel Player of the Month, Top 3, deine Position und Hall of Fame.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <BullsRankingContent showBackLink />
      </BullsGate>
    </AppLayout>
  ),
});
