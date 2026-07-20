import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import type {
  BuilderDay,
  BuilderMeal,
  CustomerPlanContext,
  LibraryMeal,
} from "@/lib/plan-builder.functions";
import {
  autoFillDayPair,
  makeGroupId,
  scaleFactorToTarget,
  targetsFor,
  type PartnerSlotLink,
  type SharedSlotsMap,
  type Slot,
} from "../lib/plan-builder.logic";
import { DayCard } from "./DayCard";

export function PartnerDayBlock({
  clientDay,
  partnerDay,
  clientCtx,
  partnerCtx,
  clientName,
  partnerName,
  library,
  sharedSlots,
  onClientChange,
  onPartnerChange,
  onCopy,
}: {
  clientDay: BuilderDay;
  partnerDay: BuilderDay;
  clientCtx: CustomerPlanContext;
  partnerCtx: CustomerPlanContext;
  clientName: string;
  partnerName: string;
  library: LibraryMeal[];
  sharedSlots: SharedSlotsMap;
  onClientChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onPartnerChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onCopy: () => void;
}) {
  // Sync coupled meals (same linked_partner_group) → recipe from client mirrors to partner.
  // Portion factor stays per person. Runs after render.
  useEffect(() => {
    for (const cm of clientDay.meals) {
      if (!cm.linked_partner_group) continue;
      const pm = partnerDay.meals.find((x) => x.linked_partner_group === cm.linked_partner_group);
      if (!pm) continue;
      const differentRecipe =
        pm.library_meal_id !== cm.library_meal_id ||
        pm.name !== cm.name ||
        pm.ingredients.length !== cm.ingredients.length ||
        pm.ingredients.some((ing, i) => ing.name !== cm.ingredients[i]?.name);
      if (differentRecipe) {
        onPartnerChange((d) => ({
          ...d,
          meals: d.meals.map((m) =>
            m.linked_partner_group === cm.linked_partner_group
              ? {
                  ...m,
                  slot: cm.slot,
                  name: cm.name,
                  description: cm.description ?? null,
                  library_meal_id: cm.library_meal_id ?? null,
                  ingredients: cm.ingredients.map((i) => ({ ...i })),
                }
              : m,
          ),
        }));
      }
    }
  }, [clientDay.meals]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoFillPair = () => {
    const res = autoFillDayPair(
      clientDay,
      partnerDay,
      clientCtx,
      partnerCtx,
      library,
      "empty_only",
      sharedSlots,
    );
    onClientChange(() => res.client);
    onPartnerChange(() => res.partner);
    if (res.missing > 0) {
      toast.warning(
        `Für ${res.missing} Slot(s) wurde keine passende Mahlzeit gefunden. Bitte Mahlzeitendatenbank erweitern oder Filter prüfen.`,
      );
    }
  };

  const cTargetKcal = targetsFor(clientDay, clientCtx).kcal;
  const pTargetKcal = targetsFor(partnerDay, partnerCtx).kcal;

  // Couple a slot: mirror recipe to the other side, scale portion to their target.
  // "from" = which side is the master (has the meal to mirror).
  const coupleSlot = (slot: Slot, from: "client" | "partner") => {
    const cM = clientDay.meals.find((m) => m.slot === slot);
    const pM = partnerDay.meals.find((m) => m.slot === slot);
    const group = makeGroupId();
    if (from === "client") {
      if (!cM) return;
      const scaledFactor = scaleFactorToTarget(cM.portion_factor ?? 1, cTargetKcal, pTargetKcal);
      onClientChange((d) => ({
        ...d,
        meals: d.meals.map((m) => (m.slot === slot ? { ...m, linked_partner_group: group } : m)),
      }));
      if (pM) {
        // Both exist — link group, rescale partner factor, sync recipe via useEffect.
        onPartnerChange((d) => ({
          ...d,
          meals: d.meals.map((m) =>
            m.slot === slot
              ? { ...m, linked_partner_group: group, portion_factor: scaledFactor }
              : m,
          ),
        }));
      } else {
        // Clone recipe to partner slot with scaled portion.
        const clone: BuilderMeal = {
          ...cM,
          ingredients: cM.ingredients.map((i) => ({ ...i })),
          linked_prep_group: null,
          linked_partner_group: group,
          portion_factor: scaledFactor,
          is_locked: false,
        };
        onPartnerChange((d) => ({
          ...d,
          meals: [...d.meals.filter((m) => m.slot !== slot), clone],
        }));
      }
    } else {
      if (!pM) return;
      const scaledFactor = scaleFactorToTarget(pM.portion_factor ?? 1, pTargetKcal, cTargetKcal);
      onPartnerChange((d) => ({
        ...d,
        meals: d.meals.map((m) => (m.slot === slot ? { ...m, linked_partner_group: group } : m)),
      }));
      if (cM) {
        onClientChange((d) => ({
          ...d,
          meals: d.meals.map((m) =>
            m.slot === slot
              ? { ...m, linked_partner_group: group, portion_factor: scaledFactor }
              : m,
          ),
        }));
      } else {
        const clone: BuilderMeal = {
          ...pM,
          ingredients: pM.ingredients.map((i) => ({ ...i })),
          linked_prep_group: null,
          linked_partner_group: group,
          portion_factor: scaledFactor,
          is_locked: false,
        };
        onClientChange((d) => ({
          ...d,
          meals: [...d.meals.filter((m) => m.slot !== slot), clone],
        }));
      }
    }
  };

  const uncoupleSlot = (slot: Slot) => {
    onClientChange((d) => ({
      ...d,
      meals: d.meals.map((m) => (m.slot === slot ? { ...m, linked_partner_group: null } : m)),
    }));
    onPartnerChange((d) => ({
      ...d,
      meals: d.meals.map((m) => (m.slot === slot ? { ...m, linked_partner_group: null } : m)),
    }));
  };

  // Swap for both: update recipe on both sides, keep group, rescale "other" factor to target.
  const swapCoupled = (slot: Slot, lib: LibraryMeal, from: "client" | "partner") => {
    const ing = (lib.ingredients ?? []).map((i) => ({
      name: i.name,
      grams: Math.round(i.amount_g ?? 0),
    }));
    const patch = {
      name: lib.name,
      description: lib.description,
      library_meal_id: lib.id,
      ingredients: ing,
    };
    const cM = clientDay.meals.find((m) => m.slot === slot);
    const pM = partnerDay.meals.find((m) => m.slot === slot);
    const baseFactor = from === "client" ? (cM?.portion_factor ?? 1) : (pM?.portion_factor ?? 1);
    const otherFactor =
      from === "client"
        ? scaleFactorToTarget(baseFactor, cTargetKcal, pTargetKcal)
        : scaleFactorToTarget(baseFactor, pTargetKcal, cTargetKcal);
    onClientChange((d) => ({
      ...d,
      meals: d.meals.map((m) =>
        m.slot === slot
          ? {
              ...m,
              ...patch,
              ingredients: patch.ingredients.map((i) => ({ ...i })),
              portion_factor: from === "client" ? (m.portion_factor ?? 1) : otherFactor,
            }
          : m,
      ),
    }));
    onPartnerChange((d) => ({
      ...d,
      meals: d.meals.map((m) =>
        m.slot === slot
          ? {
              ...m,
              ...patch,
              ingredients: patch.ingredients.map((i) => ({ ...i })),
              portion_factor: from === "partner" ? (m.portion_factor ?? 1) : otherFactor,
            }
          : m,
      ),
    }));
  };

  const isCoupled = (slot: Slot) => {
    const cM = clientDay.meals.find((m) => m.slot === slot);
    const pM = partnerDay.meals.find((m) => m.slot === slot);
    return !!(cM?.linked_partner_group && pM?.linked_partner_group === cM.linked_partner_group);
  };

  const linkForClient = (slot: Slot): PartnerSlotLink => ({
    selfName: clientName,
    partnerName,
    isCoupled: isCoupled(slot),
    onCouple: () => coupleSlot(slot, "client"),
    onUncouple: () => uncoupleSlot(slot),
    onSwapForBoth: (lib) => swapCoupled(slot, lib, "client"),
  });
  const linkForPartner = (slot: Slot): PartnerSlotLink => ({
    selfName: partnerName,
    partnerName: clientName,
    isCoupled: isCoupled(slot),
    onCouple: () => coupleSlot(slot, "partner"),
    onUncouple: () => uncoupleSlot(slot),
    onSwapForBoth: (lib) => swapCoupled(slot, lib, "partner"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{clientDay.name}</CardTitle>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Users className="h-3 w-3" /> Partnerplan
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={autoFillPair}>
            <Sparkles className="mr-1 h-3 w-3" />
            Tag füllen (Paar)
          </Button>
          <Button size="sm" variant="ghost" onClick={onCopy}>
            <Copy className="mr-1 h-3 w-3" />
            auf nächsten Tag
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="client">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="client">{clientName}</TabsTrigger>
            <TabsTrigger value="partner">{partnerName}</TabsTrigger>
          </TabsList>
          <TabsContent value="client" className="mt-3">
            <DayCard
              day={clientDay}
              library={library}
              ctx={clientCtx}
              onChange={onClientChange}
              onCopy={onCopy}
              hideHeaderActions
              partnerLinkForSlot={linkForClient}
            />
          </TabsContent>
          <TabsContent value="partner" className="mt-3">
            <DayCard
              day={partnerDay}
              library={library}
              ctx={partnerCtx}
              onChange={onPartnerChange}
              onCopy={onCopy}
              hideHeaderActions
              partnerLinkForSlot={linkForPartner}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
