import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Loader2, Power, X } from "lucide-react";
import {
  createTeamJoinLink,
  listTeamJoinLinks,
  revokeTeamJoinLink,
} from "@/lib/organizations/team-join-links.functions";

/** Dialog zum Verwalten der öffentlichen Beitrittslinks eines Teams. */
export function TeamJoinLinkDialog({
  orgId,
  teamId,
  teamName,
  open,
  onClose,
}: {
  orgId: string;
  teamId: string;
  teamName: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamJoinLinks);
  const createFn = useServerFn(createTeamJoinLink);
  const revokeFn = useServerFn(revokeTeamJoinLink);

  const key = ["team-join-links", teamId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { organization_id: orgId, team_id: teamId } }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { organization_id: orgId, team_id: teamId } }),
    onSuccess: () => {
      toast.success("Beitrittslink erstellt.");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Erstellen."),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id, organization_id: orgId, team_id: teamId } }),
    onSuccess: () => {
      toast.success("Link deaktiviert.");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Deaktivieren."),
  });

  const [origin, setOrigin] = useState("");
  useEffect(() => { if (typeof window !== "undefined") setOrigin(window.location.origin); }, []);

  if (!open) return null;

  const links = q.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">Beitrittslinks</h3>
            <div className="text-xs text-muted-foreground">Team: {teamName}</div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          Über einen Beitrittslink können Spieler direkt in dieses Team eintreten und starten anschließend automatisch das Onboarding. Der Link darf mehrfach benutzt werden.
        </p>

        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mb-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" />
          {create.isPending ? "Erstelle…" : "Neuen Link erstellen"}
        </button>

        {q.isLoading ? (
          <div className="grid place-items-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : links.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Noch keine Beitrittslinks erstellt.
          </div>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const url = `${origin}/join/${l.token}`;
              return (
                <li key={l.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={url}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 truncate rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                    <button
                      onClick={async () => { await navigator.clipboard.writeText(url); toast.success("Link kopiert."); }}
                      className="rounded border border-border p-1 text-muted-foreground hover:text-foreground"
                      title="Kopieren"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {l.is_active && (
                      <button
                        onClick={() => revoke.mutate(l.id)}
                        disabled={revoke.isPending}
                        className="rounded border border-border p-1 text-muted-foreground hover:text-red-500"
                        title="Deaktivieren"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span className={l.is_active ? "text-green-500" : "text-red-500"}>
                      {l.is_active ? "aktiv" : "deaktiviert"}
                    </span>
                    <span>· {l.uses_count} Beitritte</span>
                    {l.max_uses != null && <span>· max {l.max_uses}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
