import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserMinus, X } from "lucide-react";
import { removeAthleteFromOrg } from "@/lib/organizations/athlete-admin.functions";

export function RemoveFromTeamSection({
  orgId,
  userId,
  displayName,
}: {
  orgId: string;
  userId: string;
  displayName: string;
}) {
  const navigate = useNavigate();
  const remove = useServerFn(removeAthleteFromOrg);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await remove({ data: { org_id: orgId, user_id: userId } });
      toast.success(`${displayName} aus dem Team entfernt.`);
      navigate({ to: "/coach/teams/$orgId", params: { orgId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <section className="mt-6 rounded-lg border border-[#3a1414] bg-[#170a0a] p-4">
        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-bulls-red">
          <UserMinus className="h-4 w-4" />
          Team-Verwaltung
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Entfernt {displayName} aus dem Team. Das BodyFuel-Profil, Trainings- und
          Ernährungsdaten bleiben erhalten – nur die Team-Zuordnung wird gelöst.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-bulls-red bg-bulls-red/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-bulls-red"
        >
          <UserMinus className="h-3.5 w-3.5" />
          Aus Team entfernen
        </button>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-[#252525] bg-[#0b0b0b] p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Aus Team entfernen
              </h3>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-white/5"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Möchtest du <span className="font-semibold text-white">{displayName}</span>{" "}
              wirklich aus dem Team entfernen? Das Profil im BodyFuel-System bleibt
              erhalten.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md border border-[#252525] bg-[#0b0b0b] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-bulls-red px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
              >
                <UserMinus className="h-3.5 w-3.5" />
                {busy ? "Entferne…" : "Aus Team entfernen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
