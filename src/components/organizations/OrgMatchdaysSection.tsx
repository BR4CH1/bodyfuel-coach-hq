import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  deleteOrgEvent,
  listOrgEvents,
  upsertOrgEvent,
  type OrgEvent,
} from "@/lib/organizations/organization-events.functions";

/**
 * „Spieltermine" — kontextbezogene Match-Verwaltung innerhalb der
 * Belastungssteuerung. Speicher: `organization_events` mit
 * `event_type = 'match'`. UI bewusst auf Match beschränkt; die
 * Datenstruktur bleibt generisch für spätere Kalender-Ansichten.
 */
export function OrgMatchdaysSection({
  orgId,
  teams,
  canManage,
  teamFilterId,
}: {
  orgId: string;
  teams: { id: string; name: string }[];
  canManage: boolean;
  /** Optional: aktuell im OrgLoadTab gewählter Team-Filter. */
  teamFilterId: string | null;
}) {
  const listFn = useServerFn(listOrgEvents);
  const upsertFn = useServerFn(upsertOrgEvent);
  const deleteFn = useServerFn(deleteOrgEvent);
  const qc = useQueryClient();

  const queryKey = ["org-matchdays", orgId, teamFilterId ?? "all"];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      listFn({
        data: {
          orgId,
          eventType: "match",
          // team-Filter bewusst nicht hart mitgeschickt — Coach soll auch
          // orgweite Matches sehen. Wir filtern client-seitig weiter unten.
        },
      }),
  });

  const events = (rows as OrgEvent[]).filter((e) => {
    if (!teamFilterId) return true;
    return e.team_id === teamFilterId || e.team_id === null;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrgEvent | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-bulls-red" />
          Spieltermine
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bulls-red/60 bg-bulls-red/10 px-3 py-1.5 text-xs font-semibold text-bulls-red hover:bg-bulls-red/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Spieltermin hinzufügen
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Lädt…</div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Noch keine Spieltermine erfasst.
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const teamName = e.team_id
              ? teams.find((t) => t.id === e.team_id)?.name ?? "Team"
              : "Orgweit";
            const dt = new Date(e.starts_at);
            const dateLabel = dt.toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const timeLabel = dt.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3"
              >
                <div className="flex-1 min-w-[220px]">
                  <div className="text-sm font-semibold">{dateLabel}</div>
                  <div className="text-xs text-muted-foreground">
                    {timeLabel} Uhr
                    {e.opponent ? ` · vs. ${e.opponent}` : ""}
                    {e.competition ? ` · ${e.competition}` : ""}
                    {e.location ? ` · ${e.location}` : ""}
                  </div>
                  <div className="mt-1 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Team: {teamName}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(e);
                        setModalOpen(true);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-md border border-border hover:border-bulls-red/60"
                      aria-label="Bearbeiten"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Spieltermin wirklich löschen?")) del.mutate(e.id);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-md border border-border hover:border-bulls-red/60"
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <MatchdayModal
          orgId={orgId}
          teams={teams}
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSave={async (payload) => {
            await upsertFn({ data: payload });
            await qc.invalidateQueries({ queryKey });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function MatchdayModal({
  orgId,
  teams,
  initial,
  onClose,
  onSave,
}: {
  orgId: string;
  teams: { id: string; name: string }[];
  initial: OrgEvent | null;
  onClose: () => void;
  onSave: (payload: {
    id?: string | null;
    orgId: string;
    teamId: string | null;
    event_type: "match";
    starts_at: string;
    opponent: string | null;
    competition: string | null;
    location: string | null;
  }) => Promise<void>;
}) {
  const initStart = initial ? new Date(initial.starts_at) : null;
  const initDate = initStart
    ? `${initStart.getFullYear()}-${String(initStart.getMonth() + 1).padStart(2, "0")}-${String(initStart.getDate()).padStart(2, "0")}`
    : "";
  const initTime = initStart
    ? `${String(initStart.getHours()).padStart(2, "0")}:${String(initStart.getMinutes()).padStart(2, "0")}`
    : "15:00";

  const [teamId, setTeamId] = useState<string | null>(initial?.team_id ?? null);
  const [date, setDate] = useState(initDate);
  const [time, setTime] = useState(initTime);
  const [opponent, setOpponent] = useState(initial?.opponent ?? "");
  const [competition, setCompetition] = useState(initial?.competition ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!date || !time) return;
    setSaving(true);
    try {
      // Lokale Zeit → ISO. Speichern als vollqualifiziertes ISO-Datum;
      // Anzeige rekonstruiert in lokaler TZ des Nutzers.
      const iso = new Date(`${date}T${time}:00`).toISOString();
      await onSave({
        id: initial?.id ?? null,
        orgId,
        teamId,
        event_type: "match",
        starts_at: iso,
        opponent: opponent.trim() || null,
        competition: competition.trim() || null,
        location: location.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="text-sm font-semibold">
            {initial ? "Spieltermin bearbeiten" : "Spieltermin hinzufügen"}
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <Field label="Team / Squad">
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value || null)}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Orgweit (alle Teams)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Datum">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Uhrzeit">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
          </div>
          <Field label="Gegner (optional)">
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="z. B. FC Musterstadt"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Wettbewerb (optional)">
            <input
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder="z. B. Bundesliga, Pokal"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Ort (optional)">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z. B. Heimstadion"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving || !date || !time}
            className="rounded-lg bg-bulls-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-bulls-red/90 disabled:opacity-60"
          >
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
