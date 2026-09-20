import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookmarkPlus, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PLAN_CONFIG,
  PlanConfiguratorCard,
  type PlanConfig,
} from "@/components/bodyfuel/PlanConfiguratorCard";
import { PlanValidationSummary } from "@/components/bodyfuel/PlanValidationSummary";
import { buildForbiddenTerms, validateGeneratedPlan } from "@/lib/nutrition-plan-constraints";
import {
  deleteNutritionPlanTemplate,
  listNutritionPlanTemplates,
  saveNutritionPlanTemplate,
  type NutritionPlanTemplate,
} from "@/lib/nutrition-plan-templates.functions";
import { saveCustomerPlanConfig } from "@/lib/smart-profile.functions";
import type { BuilderDay, CustomerPlanContext } from "@/lib/plan-builder.functions";
import { targetsFor } from "../lib/plan-builder.logic";

export function PlanSetupPanel({
  userId,
  days,
  partnerDays,
  partnerMode,
  sharedSlots,
  customerContext,
  onApplyTemplate,
}: {
  userId: string;
  days: BuilderDay[];
  partnerDays: BuilderDay[];
  partnerMode: boolean;
  sharedSlots: Record<string, boolean>;
  customerContext: CustomerPlanContext;
  onApplyTemplate: (
    templateDays: BuilderDay[],
    templatePartnerDays?: BuilderDay[] | null,
  ) => void;
}) {
  const queryClient = useQueryClient();
  const saveConfigFn = useServerFn(saveCustomerPlanConfig);
  const listTemplatesFn = useServerFn(listNutritionPlanTemplates);
  const saveTemplateFn = useServerFn(saveNutritionPlanTemplate);
  const deleteTemplateFn = useServerFn(deleteNutritionPlanTemplate);

  const [config, setConfig] = useState<PlanConfig>(() => ({
    ...DEFAULT_PLAN_CONFIG,
    customExclusions: customerContext.noGoFoods ?? [],
    preferences: customerContext.requestedMeals ?? [],
    planDays: days.length || 7,
    partner: partnerMode,
  }));
  const [templateName, setTemplateName] = useState("");

  const templates = useQuery({
    queryKey: ["nutrition-plan-templates"],
    queryFn: () => listTemplatesFn(),
  });

  const saveConfig = useMutation({
    mutationFn: () =>
      saveConfigFn({
        data: {
          user_id: userId,
          goal: config.goal,
          diet_rules: config.dietRules,
          exclusion_groups: config.exclusionGroups,
          custom_exclusions: config.customExclusions,
          preferences: config.preferences,
          lifestyle: config.lifestyle,
          meals_per_day: config.mealsPerDay,
        },
      }),
    onSuccess: async () => {
      // Der Builder filtert die Gerichte über das Kundenprofil — neu laden,
      // damit die Regeln sofort in Bibliothek und Auto-Füllen greifen.
      await queryClient.invalidateQueries({ queryKey: ["plan-ctx", userId] });
      await queryClient.invalidateQueries({ queryKey: ["smart-profile", userId] });
      toast.success("Regeln übernommen — sie gelten ab jetzt für die Gerichtsauswahl.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen."),
  });

  const saveTemplate = useMutation({
    mutationFn: (id?: string) =>
      saveTemplateFn({
        data: {
          ...(id ? { id } : {}),
          title: id
            ? (templates.data?.find((template) => template.id === id)?.title ?? templateName)
            : templateName,
          days,
          partnerDays: partnerMode && partnerDays.length ? partnerDays : null,
          sharedSlots: partnerMode ? sharedSlots : null,
          config: {
            goal: config.goal,
            dietRules: config.dietRules,
            exclusionGroups: config.exclusionGroups,
            customExclusions: config.customExclusions,
            preferences: config.preferences,
            lifestyle: config.lifestyle,
            mealsPerDay: config.mealsPerDay,
          },
        },
      }),
    onSuccess: async () => {
      setTemplateName("");
      await queryClient.invalidateQueries({ queryKey: ["nutrition-plan-templates"] });
      toast.success("Vorlage gespeichert.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Vorlage konnte nicht gespeichert werden."),
  });

  const removeTemplate = useMutation({
    mutationFn: (id: string) => deleteTemplateFn({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nutrition-plan-templates"] });
      toast.success("Vorlage gelöscht.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen."),
  });

  const applyTemplate = (template: NutritionPlanTemplate) => {
    onApplyTemplate(template.days, template.partner_days);
    if (template.config) {
      setConfig((current) => ({
        ...current,
        goal: (template.config?.goal as PlanConfig["goal"]) ?? current.goal,
        dietRules: (template.config?.dietRules as PlanConfig["dietRules"]) ?? current.dietRules,
        exclusionGroups:
          (template.config?.exclusionGroups as PlanConfig["exclusionGroups"]) ??
          current.exclusionGroups,
        customExclusions: template.config?.customExclusions ?? current.customExclusions,
        preferences: template.config?.preferences ?? current.preferences,
        lifestyle: (template.config?.lifestyle as PlanConfig["lifestyle"]) ?? current.lifestyle,
        mealsPerDay: template.config?.mealsPerDay ?? current.mealsPerDay,
        variation:
          (template.config?.variation as PlanConfig["variation"]) ?? current.variation,
      }));
    }
    toast.success(`Vorlage „${template.title}“ übernommen.`);
  };

  // Live-Prüfung der aktuell geplanten Woche.
  const validation = useMemo(() => {
    const forbidden = buildForbiddenTerms(
      {
        dietRules: config.dietRules,
        exclusionGroups: config.exclusionGroups,
        customExclusions: config.customExclusions,
      },
      [
        ...(customerContext.noGoFoods ?? []),
        ...(customerContext.allergies ?? []),
        ...(customerContext.intolerances ?? []),
      ],
    );
    return validateGeneratedPlan({
      days: days.map((day) => ({
        name: day.name,
        meals: day.meals.map((meal) => ({
          name: meal.name,
          slot: meal.slot,
          kcal: Number(meal.kcal) || 0,
          protein_g: Number(meal.protein_g) || 0,
          carbs_g: Number(meal.carbs_g) || 0,
          fat_g: Number(meal.fat_g) || 0,
          ingredients: (meal.ingredients ?? []).map((ingredient: { name?: string | null }) => ({
            name: String(ingredient?.name ?? ""),
          })),
        })),
      })),
      forbidden,
      config: {
        dietRules: config.dietRules,
        exclusionGroups: config.exclusionGroups,
        customExclusions: config.customExclusions,
        mealsPerDay: config.mealsPerDay,
        planDays: days.length,
      },
      targets: days.map((day) => {
        const target = targetsFor(day, customerContext);
        return {
          kcal: target.kcal,
          protein_g: target.p,
          carbs_g: target.c,
          fat_g: target.f,
        };
      }),
      kcalTolerance: 0.2,
      allergyTerms: [
        ...(customerContext.allergies ?? []),
        ...(customerContext.intolerances ?? []),
      ],
      variation: config.variation,
    });
  }, [config, customerContext, days]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Regeln, Prüfung &amp; Vorlagen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PlanConfiguratorCard
          value={{ ...config, planDays: days.length || config.planDays, partner: partnerMode }}
          onChange={setConfig}
          partnerAvailable={partnerMode}
          customPeriod
        />
        <Button
          size="sm"
          onClick={() => saveConfig.mutate()}
          disabled={saveConfig.isPending}
          className="w-full sm:w-auto"
        >
          {saveConfig.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1 h-3.5 w-3.5" />
          )}
          Regeln übernehmen
        </Button>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prüfung dieser Woche
          </div>
          <PlanValidationSummary report={validation} />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vorlagen
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Name der Vorlage, z. B. Woche Aufbau 1600"
              className="h-10 min-w-0 flex-1"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => saveTemplate.mutate(undefined)}
              disabled={saveTemplate.isPending || !templateName.trim() || days.length === 0}
            >
              {saveTemplate.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
              )}
              Als Vorlage speichern
            </Button>
          </div>

          {templates.isLoading ? (
            <p className="text-xs text-muted-foreground">Vorlagen werden geladen …</p>
          ) : (templates.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Noch keine Vorlagen. Plane eine Woche und speichere sie hier, um sie später für
              andere Kunden wiederzuverwenden.
            </p>
          ) : (
            <ul className="space-y-2">
              {(templates.data ?? []).map((template) => (
                <li
                  key={template.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-xs font-semibold">{template.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {template.plan_days} Tage
                      {template.partner_days ? " · mit Partner" : ""} · zuletzt{" "}
                      {new Date(template.updated_at).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => applyTemplate(template)}>
                    Übernehmen
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => saveTemplate.mutate(template.id)}
                    disabled={saveTemplate.isPending || days.length === 0}
                    title="Vorlage mit der aktuellen Woche überschreiben"
                  >
                    Aktualisieren
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeTemplate.mutate(template.id)}
                    disabled={removeTemplate.isPending}
                    aria-label={`${template.title} löschen`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
