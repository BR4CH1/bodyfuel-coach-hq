import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Undo2, Users, Wand2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DayCard } from "@/features/nutrition-plan-builder/components/DayCard";
import { PartnerDayBlock } from "@/features/nutrition-plan-builder/components/PartnerDayBlock";
import {
  SLOTS,
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

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lade …</div>;
  }
  if (libraryError) {
    return (
      <div className="p-6 text-sm text-destructive">Bibliothek konnte nicht geladen werden.</div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-32">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
        </Button>
        <h1 className="font-display text-lg font-bold">Plan manuell erstellen</h1>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Zeitraum</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      {days.map((day, dayIndex) =>
        partnerMode && partnerContext && partnerDays[dayIndex] ? (
          <PartnerDayBlock
            key={day.name}
            clientDay={day}
            partnerDay={partnerDays[dayIndex]}
            clientCtx={customerContext!}
            partnerCtx={partnerContext}
            clientName="Kunde"
            partnerName={partnerName}
            library={library}
            sharedSlots={sharedSlots}
            onClientChange={(update) => setDay(dayIndex, update)}
            onPartnerChange={(update) => setPartnerDay(dayIndex, update)}
            onCopy={() => setCopyChoiceIdx(dayIndex)}
          />
        ) : (
          <DayCard
            key={day.name}
            day={day}
            library={library}
            ctx={customerContext!}
            onChange={(update) => setDay(dayIndex, update)}
            onCopy={() => copyClientDay(dayIndex)}
          />
        ),
      )}

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

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background/95 p-3 backdrop-blur">
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
