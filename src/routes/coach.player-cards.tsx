import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Download,
  Filter,
  Loader2,
  Share2,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { listCoachPlayerCards } from "@/lib/player-cards.functions";
import { PlayerCard, type PlayerCardData } from "@/components/player-cards/PlayerCard";
import { PlayerCardShareDialog } from "@/components/player-cards/PlayerCardShareDialog";
import { cardToPngBlob, slugify } from "@/lib/player-cards/export";

export const Route = createFileRoute("/coach/player-cards")({
  head: () => ({ meta: [{ title: "Player Cards — Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachPlayerCardsPage />
    </AppLayout>
  ),
});

type SortKey = "bfr_desc" | "bfr_asc" | "name" | "updated";

function computeAge(bd: string | null | undefined): number | null {
  if (!bd) return null;
  const d = new Date(bd);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

function CoachPlayerCardsPage() {
  const navigate = useNavigate();
  const { supabaseUser, loading: sessionLoading } = useSession();
  const listFn = useServerFn(listCoachPlayerCards);

  useEffect(() => {
    if (!sessionLoading && !supabaseUser) navigate({ to: "/auth" });
  }, [sessionLoading, supabaseUser, navigate]);

  const q = useQuery({
    queryKey: ["coach-player-cards"],
    queryFn: () => listFn(),
    enabled: !!supabaseUser,
  });

  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [posFilter, setPosFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [ageBucket, setAgeBucket] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("bfr_desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareData, setShareData] = useState<PlayerCardData | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const cards = q.data?.cards ?? [];

  const filterOptions = useMemo(() => {
    const positions = new Set<string>();
    const teams = new Map<string, string>();
    const orgs = new Map<string, string>();
    for (const c of cards) {
      const pos = c.card.position_key ?? c.bullsProfile?.position ?? null;
      if (pos) positions.add(pos);
      if (c.teamId && c.teamName) teams.set(c.teamId, c.teamName);
      if (c.organization?.id) orgs.set(c.organization.id, c.organization.name);
    }
    return {
      positions: Array.from(positions).sort(),
      teams: Array.from(teams.entries()),
      orgs: Array.from(orgs.entries()),
    };
  }, [cards]);

  const filtered = useMemo(() => {
    const out = cards.filter((c) => {
      if (orgFilter !== "all" && c.organization?.id !== orgFilter) return false;
      const pos = c.card.position_key ?? c.bullsProfile?.position ?? null;
      if (posFilter !== "all" && pos !== posFilter) return false;
      if (teamFilter !== "all" && c.teamId !== teamFilter) return false;
      if (ageBucket !== "all") {
        const age = computeAge(c.profile?.birthdate);
        if (age == null) return false;
        if (ageBucket === "u18" && age >= 18) return false;
        if (ageBucket === "u23" && (age < 18 || age >= 23)) return false;
        if (ageBucket === "senior" && age < 23) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      if (sortKey === "bfr_desc") return (b.card.bfr ?? -1) - (a.card.bfr ?? -1);
      if (sortKey === "bfr_asc") return (a.card.bfr ?? 999) - (b.card.bfr ?? 999);
      if (sortKey === "updated")
        return new Date(b.card.computed_at).getTime() - new Date(a.card.computed_at).getTime();
      const an = a.bullsProfile?.last_name ?? a.profile?.display_name ?? "";
      const bn = b.bullsProfile?.last_name ?? b.profile?.display_name ?? "";
      return an.localeCompare(bn);
    });
    return out;
  }, [cards, orgFilter, posFilter, teamFilter, ageBucket, sortKey]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.map((c) => c.card.id)));
  const clearSelection = () => setSelected(new Set());

  const bulkExportRef = useRef<HTMLDivElement>(null);
  const [bulkQueue, setBulkQueue] = useState<PlayerCardData[]>([]);

  const startBulkExport = async () => {
    if (selected.size === 0) return;
    const items = filtered.filter((c) => selected.has(c.card.id));
    const zip = new JSZip();
    setBulkBusy(true);
    try {
      for (const item of items) {
        // Render the card off-screen synchronously and snap it.
        const data: PlayerCardData = {
          card: item.card as any,
          profile: item.profile,
          bullsProfile: item.bullsProfile,
          organization: item.organization,
          teamLabel: item.teamName,
          jerseyNumber: item.jerseyNumber,
        };
        setBulkQueue([data]);
        // Warten bis das Off-Screen-Node gerendert ist.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const node = bulkExportRef.current;
        if (!node) continue;
        const blob = await cardToPngBlob(node, { pixelRatio: 2 });
        const last =
          item.bullsProfile?.last_name ??
          item.profile?.display_name?.split(" ").slice(-1)[0] ??
          "player";
        zip.file(`bfr-${slugify(last)}-${item.card.bfr ?? 0}.png`, blob);
      }
      setBulkQueue([]);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `player-cards-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success(`${items.length} Karten exportiert`);
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk-Export fehlgeschlagen");
    } finally {
      setBulkBusy(false);
    }
  };

  if (!supabaseUser) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">
        Zugriff wird geprüft…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <Link to="/coach" className="text-xs text-muted-foreground hover:text-bulls-red">
        ← Coach-Cockpit
      </Link>

      <header className="flex flex-col gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">
          Coach
        </div>
        <h1 className="font-display text-3xl font-bold">Player Cards</h1>
        <p className="text-xs text-muted-foreground">
          Alle Karten aus deinen Vereinen. Filtern, sortieren, einzeln teilen oder mehrere als ZIP herunterladen.
        </p>
      </header>

      {/* Filters + Sort */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <FilterSelect
          icon={<Filter className="h-3.5 w-3.5" />}
          label="Verein"
          value={orgFilter}
          onChange={setOrgFilter}
          options={[["all", "Alle Vereine"], ...filterOptions.orgs]}
        />
        <FilterSelect
          label="Team"
          value={teamFilter}
          onChange={setTeamFilter}
          options={[["all", "Alle Teams"], ...filterOptions.teams]}
        />
        <FilterSelect
          label="Position"
          value={posFilter}
          onChange={setPosFilter}
          options={[["all", "Alle Positionen"], ...filterOptions.positions.map((p) => [p, p] as [string, string])]}
        />
        <FilterSelect
          label="Altersklasse"
          value={ageBucket}
          onChange={setAgeBucket}
          options={[
            ["all", "Alle Altersklassen"],
            ["u18", "U18"],
            ["u23", "U19–U23"],
            ["senior", "Senior (23+)"],
          ]}
        />
        <FilterSelect
          icon={<ArrowUpDown className="h-3.5 w-3.5" />}
          label="Sortierung"
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
          options={[
            ["bfr_desc", "BFR: Hoch → Niedrig"],
            ["bfr_asc", "BFR: Niedrig → Hoch"],
            ["updated", "Zuletzt aktualisiert"],
            ["name", "Nachname"],
          ]}
        />
        <div className="flex items-end">
          <div className="w-full rounded-full border border-border bg-card px-3 py-2 text-center text-xs text-muted-foreground">
            {filtered.length} Karten
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-2 rounded-xl border border-bulls-red/40 bg-black/80 px-3 py-2 text-xs text-white backdrop-blur">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-bulls-red" />
            <span className="font-semibold">{selected.size} ausgewählt</span>
            <button onClick={selectAll} className="text-white/70 underline-offset-2 hover:underline">
              Alle sichtbaren
            </button>
            <button onClick={clearSelection} className="text-white/70 underline-offset-2 hover:underline">
              Auswahl leeren
            </button>
          </div>
          <button
            type="button"
            onClick={startBulkExport}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {bulkBusy ? "Rendere…" : "Als ZIP exportieren"}
          </button>
        </div>
      )}

      {/* Grid */}
      {q.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Keine Karten für die aktuelle Filter-Kombination.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((c) => {
            const data: PlayerCardData = {
              card: c.card as any,
              profile: c.profile,
              bullsProfile: c.bullsProfile,
              organization: c.organization,
              teamLabel: c.teamName,
              jerseyNumber: c.jerseyNumber,
            };
            const isSelected = selected.has(c.card.id);
            return (
              <div key={c.card.id} className="group relative">
                <div style={{ aspectRatio: "2 / 3" }}>
                  <PlayerCard data={data} />
                </div>
                {/* Overlay actions */}
                <div className="absolute inset-x-1 top-1 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-red-500"
                      checked={isSelected}
                      onChange={() => toggle(c.card.id)}
                    />
                    {isSelected ? "Ausgewählt" : "Wählen"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShareData(data)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:text-bulls-red"
                    aria-label="Teilen"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shareData && (
        <PlayerCardShareDialog data={shareData} open={true} onClose={() => setShareData(null)} />
      )}

      {/* Off-screen Node für Bulk-Rendering. */}
      <div
        aria-hidden
        style={{ position: "fixed", left: "-99999px", top: 0, width: 600, height: 900, pointerEvents: "none" }}
      >
        {bulkQueue[0] && (
          <div ref={bulkExportRef} style={{ width: 600, height: 900 }}>
            <PlayerCard data={bulkQueue[0]} />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground focus:border-bulls-red focus:outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
