import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  deletePerformanceTeamOrganization,
  getIsPlatformOwner,
} from "@/lib/organizations/organizations.functions";

/**
 * Owner-only Gefahrenzone am Ende der Organisationsverwaltung.
 * Doppelte Sicherheitsabfrage:
 *   1) Warn-Modal mit Aufklärung → „Ich möchte fortfahren"
 *   2) Bestätigung durch exakten Namen + Checkbox → finaler Delete-Button
 * Bulls-Slug wird zusätzlich serverseitig geblockt.
 */
export function OrgDangerZone({
  organizationId,
  organizationName,
  organizationSlug,
}: {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
}) {
  const isOwnerFn = useServerFn(getIsPlatformOwner);
  const deleteFn = useServerFn(deletePerformanceTeamOrganization);
  const navigate = useNavigate();
  const { data: isOwner } = useQuery({
    queryKey: ["is-platform-owner"],
    queryFn: () => isOwnerFn(),
  });

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typedName, setTypedName] = useState("");
  const [ack, setAck] = useState(false);

  const isBulls = /bulls/i.test(organizationSlug);

  const del = useMutation({
    mutationFn: () =>
      deleteFn({ data: { organization_id: organizationId, confirm_name: typedName } }),
    onSuccess: () => {
      toast.success(`„${organizationName}" wurde vollständig gelöscht.`);
      navigate({ to: "/coach/performance-teams" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Löschen fehlgeschlagen."),
  });

  if (!isOwner || isBulls) return null;

  const reset = () => {
    setStep(0);
    setTypedName("");
    setAck(false);
  };

  const nameMatches = typedName.trim() === organizationName.trim();
  const canFinalDelete = nameMatches && ack && !del.isPending;

  return (
    <section className="mt-10 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold text-destructive">Gefahrenzone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aktionen in diesem Bereich sind endgültig und können nicht rückgängig
            gemacht werden. Nur für Plattform-Owner sichtbar.
          </p>

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Organisation vollständig löschen</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Die Organisation und alle organisationsbezogenen Daten werden
                dauerhaft gelöscht. Globale BodyFuel-Accounts der Mitglieder
                bleiben bestehen.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setStep(1)}
              className="gap-2 whitespace-nowrap"
            >
              <Trash2 className="h-4 w-4" /> Organisation vollständig löschen
            </Button>
          </div>
        </div>
      </div>

      {/* Schritt 1: Warn-Modal */}
      <Dialog
        open={step === 1}
        onOpenChange={(o) => {
          if (!o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              „{organizationName}" wirklich vollständig löschen?
            </DialogTitle>
            <DialogDescription>
              Mannschaften, organisationsbezogene Pläne, Aufgaben, Posts,
              Challenges, Rankings, Team-Zuordnungen und weitere
              organisationsbezogene Daten werden dauerhaft entfernt.
              <br />
              <br />
              Globale BodyFuel-Accounts der Mitglieder sowie deren
              Mitgliedschaften in anderen Organisationen bleiben bestehen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={() => setStep(2)}>
              Ich möchte fortfahren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schritt 2: Name-Eingabe + Checkbox */}
      <Dialog
        open={step === 2}
        onOpenChange={(o) => {
          if (!o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Endgültige Bestätigung
            </DialogTitle>
            <DialogDescription>
              Zum Bestätigen gib bitte den exakten Namen der Organisation ein:
              <br />
              <code className="mt-2 inline-block rounded bg-muted px-2 py-1 font-mono text-foreground">
                {organizationName}
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={organizationName}
              autoFocus
            />
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={ack}
                onCheckedChange={(v) => setAck(v === true)}
                className="mt-0.5"
              />
              <span>
                Ich verstehe, dass diese Aktion nicht rückgängig gemacht werden
                kann.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={reset}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={!canFinalDelete}
              onClick={() => del.mutate()}
            >
              {del.isPending ? "Lösche…" : "Organisation dauerhaft löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
