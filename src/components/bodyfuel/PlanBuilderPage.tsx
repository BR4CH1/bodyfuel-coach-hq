import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Undo2,
  Users,
  Utensils,
  Wand2,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DayCard } from "@/features/nutrition-plan-builder/components/DayCard";
import { DayNavigator } from "@/features/nutrition-plan-builder/components/DayNavigator";
import { PartnerDayBlock } from "@/features/nutrition-plan-builder/components/PartnerDayBlock";
import {
  SLOTS,
  summarizeDay,
  type AutoFillMode,
  type Slot,
} from "@/features/nutrition-plan-builder/lib/plan-builder.logic";
import { usePlanBuilder } from "@/features/nutrition-plan-builder/hooks/usePlanBuilder";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PlanBuilderPage({
  userId,
  planId,
  returnOrgId,
}: {
  userId: string;
  planId?: string;
  returnOrgId?: string;
}) {
  const {
    title,
    setTitle,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    saving,
    weekConfirmOpen,
    setWeekConfirmOpen,
    weekMode,
    setWeekMode,
    undoSnapshot,
    partnerId,
    partnerName,
    partnerMode,
    setPartnerMode,
    sharedSlots,
    setSharedSlots,
    days,
    partnerDays,
    copyChoiceIdx,
    setCopyChoiceIdx,
    library,
    customerContext,
    partnerContext,
    isLoading,
    libraryError,
    goBack,
    setDay,
    setPartnerDay,
    handleSave,
    copyClientDay,
    copyPartnerDay,
    copyDayPair,
    runAutoFillWeek,
    undoWeekFill,
  } = usePlanBuilder({ userId, planId, returnOrgId });

  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    setActiveDayIndex((current) => Math.max(0, Math.min(current, days.length - 1)));
  }, [days.length]);

  const planProgress = useMemo(() => {
    if (!customerContext) {
      return { readyDays: 0, filledSlots: 0, totalSlots: 0, percentage: 0 };
    }
    const summaries = days.map((day) => summarizeDay(day, customerContext, library));
    const filledSlots = summaries.reduce((total, summary) => total + summary.filledSlots, 0);
    const totalSlots = summaries.reduce((total, summary) => total + summary.totalSlots, 0);
    return {
      readyDays: summaries.filter((summary) => summary.isBalanced).length,
      filledSlots,
      totalSlots,
      percentage: totalSlots ? Math.round((filledSlots / totalSlots) * 100) : 0,
    };
  }, [customerContext, days, library]);

  const activeDay = days[activeDayIndex];
  const activePartnerDay = partnerDays[activeDayIndex];

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lade …</div>;
  }
  if (libraryError) {
    return (
      <div className="p-6 text-sm text-destructive">Bibliothek konnte nicht geladen werden.</div>
    );
  }
  if (!customerContext) {
    return (
      <div className="p-6 text-sm text-destructive">
        Das Kundenprofil konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 pb-32">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goBack} className="shrink-0">
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
        </Button>
        <div>
          <h1 className="font-display text-xl font-bold">Ernährungsplan Builder</h1>
          <p className="text-xs text-muted-foreground">
            Mahlzeiten auswählen, Portionen abstimmen und den Plan veröffentlichen.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setWeekMode("empty_only");
              setWeekConfirmOpen(true);
            }}
          >
            <Wand2 className="mr-1 h-3 w-3" />
            Woche automatisch füllen
          </Button>
          {undoSnapshot && (
            <Button size="sm" variant="outline" onClick={undoWeekFill}>
              <Undo2 className="mr-1 h-3 w-3" />
              Rückgängig
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={weekConfirmOpen} onOpenChange={setWeekConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Woche automatisch füllen?</AlertDialogTitle>
            <AlertDialogDescription>
              Fixierte Mahlzeiten bleiben immer erhalten. Vor der Aktion wird ein Snapshot
              gespeichert — du kannst über „Rückgängig“ zurückkehren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup
            value={weekMode}
            onValueChange={(value) => setWeekMode(value as AutoFillMode)}
            className="space-y-2 py-2"
          >
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem value="empty_only" className="mt-0.5" />
              <div>
                <div className="font-medium">Nur leere Slots füllen</div>
                <div className="text-xs text-muted-foreground">
                  Bestehende Mahlzeiten bleiben unverändert.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem value="all_unlocked" className="mt-0.5" />
              <div>
                <div className="font-medium">Alle nicht fixierten Slots neu füllen</div>
                <div className="text-xs text-muted-foreground">
                  Ersetzt nicht-fixierte Mahlzeiten durch neue Vorschläge.
                </div>
              </div>
            </label>
          </RadioGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => runAutoFillWeek(weekMode)}>
              Ausführen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-gradient-to-r from-emerald-500/10 via-background to-background pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarRange className="h-4 w-4 text-emerald-500" />
            Plan &amp; Zeitraum
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 pt-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Titel</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <Label>Enddatum</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium">Planfortschritt</span>
              <span className="font-semibold text-emerald-500">{planProgress.percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${planProgress.percentage}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <CalendarRange className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-semibold">{days.length}</div>
                <div className="text-[10px] text-muted-foreground">Tage</div>
              </div>
              <div>
                <Utensils className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-semibold">
                  {planProgress.filledSlots}/{planProgress.totalSlots}
                </div>
                <div className="text-[10px] text-muted-foreground">Mahlzeiten</div>
              </div>
              <div>
                <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-emerald-500" />
                <div className="text-sm font-semibold">
                  {planProgress.readyDays}/{days.length}
                </div>
                <div className="text-[10px] text-muted-foreground">Im Ziel</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {customerContext && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Kundenprofil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">
                Trainingstag: {customerContext.targets.kcal_train} kcal ·{" "}
                {customerContext.targets.protein_train}P/{customerContext.targets.carbs_train}C/
                {customerContext.targets.fat_train}F
              </Badge>
              <Badge variant="outline">
                Restday: {customerContext.targets.kcal_rest} kcal ·{" "}
                {customerContext.targets.protein_rest}P/{customerContext.targets.carbs_rest}C/
                {customerContext.targets.fat_rest}F
              </Badge>
            </div>
            <div>
              Trainingstage laut Profil:{" "}
              <b>
                {customerContext.trainingWeekdays.length === 0
                  ? "keine hinterlegt"
                  : customerContext.trainingWeekdays
                      .slice()
                      .sort()
                      .map((weekday) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][weekday])
                      .join(", ")}
              </b>
            </div>
            {customerContext.dietStyle && (
              <div>
                Ernährungsform: <b>{customerContext.dietStyle}</b>
              </div>
            )}
            {customerContext.allergies.length > 0 && (
              <div>Allergien: {customerContext.allergies.join(", ")}</div>
            )}
            {customerContext.noGoFoods.length > 0 && (
              <div>No-Gos: {customerContext.noGoFoods.join(", ")}</div>
            )}
            {customerContext.favoriteFoods.length > 0 && (
              <div className="text-emerald-500">
                Lieblingsfoods: {customerContext.favoriteFoods.join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {partnerId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-emerald-500" />
              Partnerplan
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3 text-xs">
            <div>
              Gemeinsamer Plan mit <b>{partnerName}</b>. Zwei verknüpfte Pläne mit eigenen Zielen
              und Portionen pro Person.
            </div>
            <Switch checked={partnerMode} onCheckedChange={setPartnerMode} />
          </CardContent>
        </Card>
      )}

      {partnerMode && partnerContext && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Partnerprofil · {partnerName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">
                Trainingstag: {partnerContext.targets.kcal_train} kcal ·{" "}
                {partnerContext.targets.protein_train}P/{partnerContext.targets.carbs_train}C/
                {partnerContext.targets.fat_train}F
              </Badge>
              <Badge variant="outline">
                Restday: {partnerContext.targets.kcal_rest} kcal ·{" "}
                {partnerContext.targets.protein_rest}P/{partnerContext.targets.carbs_rest}C/
                {partnerContext.targets.fat_rest}F
              </Badge>
            </div>
            <div>
              Trainingstage:{" "}
              <b>
                {partnerContext.trainingWeekdays.length === 0
                  ? "keine hinterlegt"
                  : partnerContext.trainingWeekdays
                      .slice()
                      .sort()
                      .map((weekday) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][weekday])
                      .join(", ")}
              </b>
            </div>
            {partnerContext.allergies.length > 0 && (
              <div>Allergien: {partnerContext.allergies.join(", ")}</div>
            )}
            {partnerContext.noGoFoods.length > 0 && (
              <div>No-Gos: {partnerContext.noGoFoods.join(", ")}</div>
            )}
          </CardContent>
        </Card>
      )}

      {partnerMode && partnerContext && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gemeinsame Mahlzeiten mit {partnerName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="text-muted-foreground">
              Nur ausgewählte Slots werden beim Auto-Fill als Paar geplant (gleiches Rezept,
              individuelle Portionen). Nicht angehakte Slots werden pro Person unabhängig geplant.
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(SLOTS as ReadonlyArray<{ key: Slot; label: string }>).map((slot) => (
                <label
                  key={slot.key}
                  className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={sharedSlots[slot.key]}
                    onChange={(event) =>
                      setSharedSlots((previous) => ({
                        ...previous,
                        [slot.key]: event.target.checked,
                      }))
                    }
                  />
                  {slot.label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {customerContext && days.length > 0 && (
        <DayNavigator
          days={days}
          activeIndex={activeDayIndex}
          onActiveIndexChange={setActiveDayIndex}
          ctx={customerContext}
          library={library}
        />
      )}

      {activeDay &&
        (partnerMode && partnerContext && activePartnerDay ? (
          <PartnerDayBlock
            key={activeDay.name}
            clientDay={activeDay}
            partnerDay={activePartnerDay}
            clientCtx={customerContext!}
            partnerCtx={partnerContext}
            clientName="Kunde"
            partnerName={partnerName}
            library={library}
            sharedSlots={sharedSlots}
            onClientChange={(update) => setDay(activeDayIndex, update)}
            onPartnerChange={(update) => setPartnerDay(activeDayIndex, update)}
            onCopy={() => setCopyChoiceIdx(activeDayIndex)}
          />
        ) : (
          <DayCard
            key={activeDay.name}
            day={activeDay}
            library={library}
            ctx={customerContext!}
            onChange={(update) => setDay(activeDayIndex, update)}
            onCopy={() => copyClientDay(activeDayIndex)}
          />
        ))}

      <AlertDialog
        open={copyChoiceIdx !== null}
        onOpenChange={(open) => !open && setCopyChoiceIdx(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tag auf nächsten Tag kopieren</AlertDialogTitle>
            <AlertDialogDescription>
              Der Trainingstag-/Restday-Status des Zieltages bleibt erhalten. Portionen werden nach
              dem Kopieren auf das jeweilige Tagesziel neu skaliert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Button
              variant="outline"
              onClick={() => {
                if (copyChoiceIdx !== null) copyClientDay(copyChoiceIdx);
                setCopyChoiceIdx(null);
              }}
            >
              Nur Kunde kopieren
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (copyChoiceIdx !== null) copyPartnerDay(copyChoiceIdx);
                setCopyChoiceIdx(null);
              }}
            >
              Nur {partnerName} kopieren
            </Button>
            <Button
              onClick={() => {
                if (copyChoiceIdx !== null) copyDayPair(copyChoiceIdx);
                setCopyChoiceIdx(null);
              }}
            >
              Beide kopieren (Kopplung bleibt erhalten)
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="sticky bottom-0 z-10 flex gap-2 rounded-t-xl border border-b-0 border-border bg-background/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur">
        <Button
          variant="outline"
          className="flex-1"
          disabled={saving}
          onClick={() => handleSave(false)}
        >
          Als Entwurf speichern
        </Button>
        <Button className="flex-1" disabled={saving} onClick={() => handleSave(true)}>
          Veröffentlichen
        </Button>
      </div>
    </div>
  );
}
