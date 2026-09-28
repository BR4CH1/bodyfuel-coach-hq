import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, RefreshCw, ArrowRight } from "lucide-react";
import { getPartnerPlanInfo, syncPartnerMeal } from "@/lib/partner-plan.functions";

/** Badge „Partnerplan" + Partnername + Link zum Partnerplan. */
export function PartnerPlanBanner({ planId }: { planId: string }) {
  const fn = useServerFn(getPartnerPlanInfo);
  const { data } = useQuery({
    queryKey: ["partner-plan-info", planId],
    queryFn: () => fn({ data: { plan_id: planId } }),
  });
  if (!data) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-md bg-gold/20 px-2 py-0.5 font-semibold uppercase tracking-wider text-gold">
        <Users className="h-3 w-3" /> Partnerplan
      </span>
      <span>
        Gemeinsam mit <strong>{data.partner_name}</strong>
      </span>
      {data.can_navigate && (
        <Link
          to="/coach/plan-preview/$planId"
          params={{ planId: data.partner_plan_id }}
          className="ml-auto inline-flex items-center gap-1 font-semibold text-gold hover:underline print:hidden"
        >
          Zum Plan von {data.partner_name} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export function PartnerPlanChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
      <Users className="h-3 w-3" /> Partnerplan · {name}
    </span>
  );
}

/** Kennzeichnung + optionale Synchronisierung einer gemeinsamen Mahlzeit. */
export function PartnerMealSync({ mealId, planId }: { mealId: string; planId: string }) {
  const fn = useServerFn(syncPartnerMeal);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => fn({ data: { meal_id: mealId } }),
    onSuccess: (r) => {
      toast.success("Rezept beim Partner übernommen — individuelle Mengen blieben erhalten.");
      qc.invalidateQueries({ queryKey: ["plan-preview"] });
      void r;
      void planId;
    },
    onError: (e: any) => toast.error(e?.message ?? "Synchronisierung fehlgeschlagen"),
  });
  return (
    <div className="flex items-center gap-2 print:hidden">
      <span className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
        <Users className="h-3 w-3" /> Partner-Mahlzeit
      </span>
      <button
        onClick={() => {
          if (confirm("Gericht und Zutatenliste auf den Partner übernehmen? Dessen eigene Mengen bleiben erhalten."))
            m.mutate();
        }}
        disabled={m.isPending}
        className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] hover:border-gold/50 disabled:opacity-50"
        title="Rezept auf Partner synchronisieren"
      >
        <RefreshCw className={`h-3 w-3 ${m.isPending ? "animate-spin" : ""}`} /> Sync
      </button>
    </div>
  );
}
