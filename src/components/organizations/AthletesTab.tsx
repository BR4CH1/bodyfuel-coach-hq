import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Copy, X, MoreHorizontal, Search, ChevronRight } from "lucide-react";
import { getOrgAthletesOnboardingAudit } from "@/lib/organizations/task-engine.functions";
import {
  canManageRoster,
  createAthleteInvite,
  createPendingRosterAthlete,
  listPendingRosterAthletes,
  deletePendingRosterAthlete,
  removeAthleteFromTeam,
  searchExistingAthletes,
  addExistingUserToTeam,
} from "@/lib/organizations/roster.functions";


type Team = { id: string; name: string };

export function AthletesTab({
  orgId,
  teamFilter,
  teams,
  allowedUserIds,
  onClearFilter,
}: {
  orgId: string;
  teamFilter: string | null;
  teams: Team[];
  allowedUserIds: Set<string> | null;
  onClearFilter: () => void;
}) {
  const qc = useQueryClient();
  const fetchAudit = useServerFn(getOrgAthletesOnboardingAudit);
  const fetchPerm = useServerFn(canManageRoster);
  const fetchPending = useServerFn(listPendingRosterAthletes);

  const { data: audit, isLoading } = useQuery({
    queryKey: ["org-onboarding-audit", orgId],
    queryFn: () => fetchAudit({ data: { organization_id: orgId } }),
  });
  const { data: perm } = useQuery({
    queryKey: ["roster-perm", orgId],
    queryFn: () => fetchPerm({ data: { organization_id: orgId } }),
    staleTime: 60_000,
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["roster-pending", orgId],
    queryFn: () => fetchPending({ data: { organization_id: orgId } }),
    enabled: !!perm?.ok,
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading || !audit) return <div className="text-xs text-muted-foreground">Lädt…</div>;

  const rows = allowedUserIds
    ? (audit.athletes as any[]).filter((a) => allowedUserIds.has(a.user_id))
    : (audit.athletes as any[]);
  const filterTeam = teamFilter ? teams.find((t) => t.id === teamFilter) : null;
  const canManage = !!perm?.ok;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["org-onboarding-audit", orgId] });
    qc.invalidateQueries({ queryKey: ["roster-pending", orgId] });
    qc.invalidateQueries({ queryKey: ["coach-org-detail", orgId] });
  };

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Athleten</h2>
          <p className="text-xs text-muted-foreground">
            Kader, Aktivität und Entwicklung im Überblick.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" />
            Athlet hinzufügen
          </button>
        )}
      </header>

      {filterTeam && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
          <span>
            Gefiltert nach Team: <strong>{filterTeam.name}</strong> ({rows.length})
          </span>
          <button
            onClick={onClearFilter}
            className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Filter entfernen
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Onboarding</th>
              <th className="px-3 py-2">Fehlende Organization-Daten</th>
              <th className="w-8 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.user_id} className="border-t border-border hover:bg-muted/40">
                <td className="px-3 py-2 font-semibold">
                  <Link
                    to="/coach/teams/$orgId/athletes/$userId"
                    params={{ orgId, userId: a.user_id }}
                    className="hover:underline"
                  >
                    {a.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {a.derived_complete ? (
                    <span className="text-green-500">ABGESCHLOSSEN</span>
                  ) : (
                    <span className="text-yellow-500">OFFEN</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {a.missing.length === 0 ? "—" : a.missing.join(", ")}
                </td>
                <td className="px-3 py-2">
                  {canManage && a.team_id && (
                    <RowActions
                      orgId={orgId}
                      userId={a.user_id}
                      teamId={a.team_id}
                      name={a.name}
                      onDone={invalidate}
                    />
                  )}
                </td>
              </tr>
            ))}
            {(pending as any[]).map((p) => (
              <tr key={`pending-${p.id}`} className="border-t border-border bg-yellow-500/5">
                <td className="px-3 py-2 font-semibold">
                  {p.first_name} {p.last_name}
                  <span className="ml-2 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-500">
                    Einladung ausstehend
                  </span>
                </td>
                <td className="px-3 py-2 text-yellow-500">MANUELL ANGELEGT</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[p.primary_position, p.jersey_number ? `#${p.jersey_number}` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-3 py-2">
                  {canManage && (
                    <PendingActions id={p.id} onDone={invalidate} />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (pending as any[]).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {filterTeam ? "Keine Athleten in diesem Team." : "Noch keine Athleten."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <AddAthleteDialog
          orgId={orgId}
          teams={teams}
          onClose={() => setDialogOpen(false)}
          onDone={() => {
            invalidate();
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

function RowActions({
  orgId,
  userId,
  teamId,
  name,
  onDone,
}: {
  orgId: string;
  userId: string;
  teamId: string;
  name: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const removeFn = useServerFn(removeAthleteFromTeam);
  const mut = useMutation({
    mutationFn: () =>
      removeFn({ data: { organization_id: orgId, user_id: userId, team_id: teamId } }),
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button
            disabled={mut.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `${name} aus dem Team entfernen? Der Account bleibt erhalten, nur die Team-Zuordnung wird deaktiviert.`,
                )
              )
                mut.mutate();
            }}
            className="w-full rounded px-3 py-2 text-left text-xs hover:bg-muted"
          >
            Aus Team entfernen
          </button>
        </div>
      )}
    </div>
  );
}

function PendingActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const del = useServerFn(deletePendingRosterAthlete);
  const mut = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button
            disabled={mut.isPending}
            onClick={() => mut.mutate()}
            className="w-full rounded px-3 py-2 text-left text-xs text-red-500 hover:bg-muted"
          >
            Kaderplatz löschen
          </button>
        </div>
      )}
    </div>
  );
}

function AddAthleteDialog({
  orgId,
  teams,
  onClose,
  onDone,
}: {
  orgId: string;
  teams: Team[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "invite" | "manual" | "existing">("choose");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            {mode === "choose" && "Athlet hinzufügen"}
            {mode === "invite" && "Athlet einladen"}
            {mode === "manual" && "Athlet manuell anlegen"}
            {mode === "existing" && "Existierenden Nutzer hinzufügen"}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "choose" && (
          <div className="space-y-2">
            <p className="mb-3 text-xs text-muted-foreground">Wie möchtest du den Athleten hinzufügen?</p>
            <button
              onClick={() => setMode("existing")}
              className="block w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
            >
              <div className="text-sm font-semibold">Existierenden BODYFUEL-Nutzer hinzufügen</div>
              <div className="text-xs text-muted-foreground">
                Nach E-Mail oder Name suchen und direkt zum Team hinzufügen.
              </div>
            </button>
            <button
              onClick={() => setMode("invite")}
              className="block w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
            >
              <div className="text-sm font-semibold">Athlet einladen</div>
              <div className="text-xs text-muted-foreground">
                Einladungslink per E-Mail senden und Profil selbst vervollständigen lassen.
              </div>
            </button>
            <button
              onClick={() => setMode("manual")}
              className="block w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
            >
              <div className="text-sm font-semibold">Athlet manuell anlegen</div>
              <div className="text-xs text-muted-foreground">
                Spieler direkt zum Kader hinzufügen. Onboarding kann später per Einladung ergänzt werden.
              </div>
            </button>
          </div>
        )}

        {mode === "invite" && <InviteForm orgId={orgId} teams={teams} onDone={onDone} />}
        {mode === "manual" && <ManualForm orgId={orgId} teams={teams} onDone={onDone} />}
        {mode === "existing" && <ExistingUserForm orgId={orgId} teams={teams} onDone={onDone} />}
      </div>
    </div>
  );
}

function ExistingUserForm({
  orgId,
  teams,
  onDone,
}: {
  orgId: string;
  teams: Team[];
  onDone: () => void;
}) {
  const search = useServerFn(searchExistingAthletes);
  const add = useServerFn(addExistingUserToTeam);
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [jersey, setJersey] = useState("");
  const [selected, setSelected] = useState<{ user_id: string; display_name: string | null; email: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const searchMut = useMutation({
    mutationFn: () => search({ data: { organization_id: orgId, query: query.trim() } }),
    onError: (e: any) => setErr(e.message ?? String(e)),
  });

  const addMut = useMutation({
    mutationFn: async () => {
      setErr(null);
      if (!selected) throw new Error("Bitte einen Nutzer auswählen.");
      if (!teamId) throw new Error("Bitte ein Team auswählen.");
      return add({
        data: {
          organization_id: orgId,
          team_id: teamId,
          user_id: selected.user_id,
          primary_position: primary || null,
          secondary_position: secondary || null,
          jersey_number: jersey ? parseInt(jersey, 10) : null,
        },
      });
    },
    onSuccess: onDone,
    onError: (e: any) => setErr(e.message ?? String(e)),
  });

  return (
    <div className="space-y-3">
      {!selected ? (
        <>
          <Field label="Suche nach E-Mail oder Name *">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim().length >= 2) searchMut.mutate();
                }}
                placeholder="z. B. max@... oder Max Muster"
                className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
              <button
                disabled={searchMut.isPending || query.trim().length < 2}
                onClick={() => searchMut.mutate()}
                className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-muted disabled:opacity-50"
              >
                <Search className="h-3 w-3" /> Suchen
              </button>
            </div>
          </Field>

          {searchMut.data && (
            <div className="max-h-64 overflow-y-auto rounded border border-border">
              {(searchMut.data as any[]).length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Keine passenden Nutzer gefunden.
                </div>
              ) : (
                (searchMut.data as any[]).map((u) => (
                  <button
                    key={u.user_id}
                    disabled={u.already_in_org}
                    onClick={() =>
                      setSelected({
                        user_id: u.user_id,
                        display_name: u.display_name,
                        email: u.email,
                      })
                    }
                    className="flex w-full items-center justify-between border-b border-border p-2 text-left last:border-0 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div>
                      <div className="text-sm font-semibold">{u.display_name ?? "(kein Name)"}</div>
                      <div className="text-[11px] text-muted-foreground">{u.email ?? "—"}</div>
                    </div>
                    {u.already_in_org && (
                      <span className="rounded bg-muted px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                        bereits im Verein
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between rounded border border-border bg-muted/40 p-2">
            <div>
              <div className="text-sm font-semibold">{selected.display_name ?? "(kein Name)"}</div>
              <div className="text-[11px] text-muted-foreground">{selected.email ?? "—"}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Ändern
            </button>
          </div>
          <Field label="Team *">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            >
              {teams.length === 0 && <option value="">Kein Team vorhanden</option>}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Position">
              <input
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Secondary">
              <input
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Nummer">
              <input
                type="number"
                value={jersey}
                onChange={(e) => setJersey(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              disabled={addMut.isPending || !teamId}
              onClick={() => addMut.mutate()}
              className="rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {addMut.isPending ? "Füge hinzu…" : "Zum Team hinzufügen"}
            </button>
          </div>
        </>
      )}
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  );
}


function InviteForm({
  orgId,
  teams,
  onDone,
}: {
  orgId: string;
  teams: Team[];
  onDone: () => void;
}) {
  const invite = useServerFn(createAthleteInvite);
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [jersey, setJersey] = useState("");
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      setErr(null);
      const res = await invite({
        data: {
          organization_id: orgId,
          team_id: teamId,
          email: email.trim(),
          primary_position: primary || null,
          secondary_position: secondary || null,
          jersey_number: jersey ? parseInt(jersey, 10) : null,
        },
      });
      return res;
    },
    onSuccess: (r) => {
      const url = `${window.location.origin}/invite/${r.invite_token}`;
      setResult({ url });
    },
    onError: (e: any) => setErr(e.message ?? String(e)),
  });

  if (result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-500">Einladung erstellt und E-Mail versendet.</p>
        <div className="rounded border border-border bg-muted/40 p-2 text-xs break-all">{result.url}</div>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(result.url)}
            className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-muted"
          >
            <Copy className="h-3 w-3" /> Link kopieren
          </button>
          <button
            onClick={onDone}
            className="ml-auto rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Team *">
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          {teams.length === 0 && <option value="">Kein Team vorhanden</option>}
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>
      <Field label="E-Mail *">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="spieler@example.com"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary Position">
          <input
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            placeholder="z. B. QB, WR"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Secondary">
          <input
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <Field label="Trikotnummer">
        <input
          type="number"
          value={jersey}
          onChange={(e) => setJersey(e.target.value)}
          className="w-32 rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          disabled={mut.isPending || !teamId || !email.trim()}
          onClick={() => mut.mutate()}
          className="rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {mut.isPending ? "Sende…" : "Einladung erstellen"}
        </button>
      </div>
    </div>
  );
}

function ManualForm({
  orgId,
  teams,
  onDone,
}: {
  orgId: string;
  teams: Team[];
  onDone: () => void;
}) {
  const create = useServerFn(createPendingRosterAthlete);
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [jersey, setJersey] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      setErr(null);
      return create({
        data: {
          organization_id: orgId,
          team_id: teamId || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dob || null,
          height_cm: heightCm ? parseInt(heightCm, 10) : null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          primary_position: primary || null,
          secondary_position: secondary || null,
          jersey_number: jersey ? parseInt(jersey, 10) : null,
        },
      });
    },
    onSuccess: onDone,
    onError: (e: any) => setErr(e.message ?? String(e)),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vorname *">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Nachname *">
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <Field label="Team">
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">— Kein Team —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Geburtsdatum">
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Größe (cm)">
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Gewicht (kg)">
          <input
            type="number"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Position">
          <input
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Secondary">
          <input
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Nummer">
          <input
            type="number"
            value={jersey}
            onChange={(e) => setJersey(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <p className="rounded border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
        Der Athlet erscheint zunächst als „Einladung ausstehend". Sobald er über eine E-Mail-Einladung
        seinen Account aktiviert, wird der Kaderplatz verknüpft.
      </p>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          disabled={mut.isPending || !firstName.trim() || !lastName.trim()}
          onClick={() => mut.mutate()}
          className="rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {mut.isPending ? "Speichere…" : "Kaderplatz anlegen"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
