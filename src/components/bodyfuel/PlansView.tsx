import { useEffect, useRef, useState } from "react";
import { FileText, Download, Upload, Archive, Trash2, Cloud, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";

type Plan = {
  id: string;
  client_id: string;
  title: string;
  file_path: string;
  file_name: string;
  is_active: boolean;
  created_at: string;
  plan_type: "nutrition" | "training";
};

type ClientOption = { id: string; display_name: string | null };

export type PlanType = "nutrition" | "training";

const LABELS: Record<PlanType, { eyebrow: string; clientTitle: string; coachTitle: string; emptyClient: string; emptyCoach: string; titleHint: string }> = {
  nutrition: {
    eyebrow: "Ernährung",
    clientTitle: "Dein Ernährungsplan",
    coachTitle: "Ernährungspläne verwalten",
    emptyClient: "Dein Coach hat noch keinen Ernährungsplan hochgeladen.",
    emptyCoach: "Für diesen Kunden gibt es noch keine Ernährungspläne.",
    titleHint: "Titel (z.B. Cut Woche 1-4)",
  },
  training: {
    eyebrow: "Training",
    clientTitle: "Dein Trainingsplan",
    coachTitle: "Trainingspläne verwalten",
    emptyClient: "Dein Coach hat noch keinen Trainingsplan hochgeladen.",
    emptyCoach: "Für diesen Kunden gibt es noch keine Trainingspläne.",
    titleHint: "Titel (z.B. Push/Pull/Legs)",
  },
};

export function PlansView({
  planType,
  onClientChange,
}: {
  planType: PlanType;
  onClientChange?: (id: string) => void;
}) {
  const { user, supabaseUser, isCoach } = useSession();
  const L = LABELS[planType];
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveClientId = isCoach ? selectedClientId : supabaseUser?.id ?? "";

  useEffect(() => {
    if (!isCoach || !supabaseUser) return;
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name")
      .then(({ data }) => {
        if (data) {
          const opts = data as ClientOption[];
          setClients(opts);
          if (opts.length && !selectedClientId) {
            setSelectedClientId(opts[0].id);
            onClientChange?.(opts[0].id);
          }
        }
      });
  }, [isCoach, supabaseUser, selectedClientId, onClientChange]);

  useEffect(() => {
    if (!effectiveClientId) {
      setPlans([]);
      return;
    }
    setLoading(true);
    let query = supabase
      .from("nutrition_plans")
      .select("*")
      .eq("client_id", effectiveClientId)
      .eq("plan_type", planType);
    if (!isCoach) {
      // Kunden sehen keine Pläne, die noch geprüft werden müssen.
      query = query.neq("status", "needs_review");
    }
    query
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setPlans((data as Plan[]) ?? []);
        setLoading(false);
      });
  }, [effectiveClientId, planType, isCoach]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveClientId) return;
    if (file.type !== "application/pdf") {
      toast.error("Nur PDF-Dateien erlaubt");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Datei größer als 20MB");
      return;
    }

    setUploading(true);
    try {
      const path = `${effectiveClientId}/${planType}/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("nutrition-plans")
        .upload(path, file, { contentType: "application/pdf" });
      if (upErr) throw upErr;

      await supabase
        .from("nutrition_plans")
        .update({ is_active: false })
        .eq("client_id", effectiveClientId)
        .eq("plan_type", planType)
        .eq("is_active", true);

      const { data: row, error: insErr } = await supabase
        .from("nutrition_plans")
        .insert({
          client_id: effectiveClientId,
          title: title.trim() || file.name.replace(/\.pdf$/i, ""),
          file_path: path,
          file_name: file.name,
          is_active: true,
          uploaded_by: supabaseUser!.id,
          plan_type: planType,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      setPlans((p) => [row as Plan, ...p.map((x) => ({ ...x, is_active: false }))]);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Plan hochgeladen");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const download = async (plan: Plan) => {
    try {
      const { data, error } = await supabase.storage
        .from("nutrition-plans")
        .download(plan.file_path);
      if (error || !data) throw error ?? new Error("Download fehlgeschlagen");
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = plan.file_name || "plan.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: unknown) {
      // Fallback: open signed URL in new tab
      const { data, error } = await supabase.storage
        .from("nutrition-plans")
        .createSignedUrl(plan.file_path, 60, { download: plan.file_name || true });
      if (error || !data) {
        toast.error(err instanceof Error ? err.message : "Download fehlgeschlagen");
        return;
      }
      window.location.href = data.signedUrl;
    }
  };

  const deletePlan = async (plan: Plan) => {
    if (!confirm(`Plan "${plan.title}" löschen?`)) return;
    const { error: sErr } = await supabase.storage.from("nutrition-plans").remove([plan.file_path]);
    if (sErr) return toast.error(sErr.message);
    const { error } = await supabase.from("nutrition_plans").delete().eq("id", plan.id);
    if (error) return toast.error(error.message);
    setPlans((p) => p.filter((x) => x.id !== plan.id));
    toast.success("Plan gelöscht");
  };

  const current = plans.find((p) => p.is_active);
  const archive = plans.filter((p) => !p.is_active);

  if (!supabaseUser) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{L.eyebrow}</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{L.clientTitle}</h1>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-accent/20 p-5">
          <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div className="text-sm">
            <div className="font-semibold">Cloud-Pläne brauchen ein echtes Login</div>
            <p className="mt-1 text-muted-foreground">
              Mit einem echten Account kann dein Coach dir Pläne als PDF hochladen — du kannst
              sie sicher abrufen und archivieren.
            </p>
            <a
              href="/auth"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Account erstellen
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{L.eyebrow}</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            {isCoach ? L.coachTitle : L.clientTitle}
          </h1>
        </div>
      </div>

      {isCoach && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Kunde</label>
          <select
            value={selectedClientId}
            onChange={(e) => { setSelectedClientId(e.target.value); onClientChange?.(e.target.value); }}
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {clients.length === 0 && <option>Noch keine Kunden registriert</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name ?? c.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      )}

      {isCoach && effectiveClientId && (
        <div className="rounded-2xl border border-gold/40 bg-card p-5">
          <h2 className="font-display text-lg font-bold">Neuen Plan hochladen</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={L.titleHint}
              maxLength={120}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Upload className="h-4 w-4" />
              {uploading ? "Lade hoch..." : "PDF wählen"}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Max. 20 MB · Der hochgeladene Plan wird automatisch als „aktiv" gesetzt.
          </p>
        </div>
      )}

      {loading && <div className="text-sm text-muted-foreground">Lade Pläne...</div>}

      {!loading && !current && !archive.length && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{isCoach ? L.emptyCoach : L.emptyClient}</span>
        </div>
      )}

      {current && (
        <div
          onClick={() => download(current)}
          className="cursor-pointer overflow-hidden rounded-3xl border border-gold/40 bg-card transition-colors hover:bg-accent/10"
        >
          <div className="border-b border-gold/30 bg-accent/30 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
              <FileText className="h-3.5 w-3.5" /> Aktueller Plan
            </div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">{current.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hochgeladen am {new Date(current.created_at).toLocaleDateString("de-DE")} ·{" "}
                  {current.file_name}
                </p>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium">
                  <Download className="h-4 w-4" /> PDF
                </span>
                {isCoach && (
                  <button
                    onClick={() => deletePlan(current)}
                    className="inline-flex items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {archive.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Archive className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg font-bold">Archiv</h2>
          </div>
          <ul className="divide-y divide-border">
            {archive.map((p) => (
              <li
                key={p.id}
                onClick={() => download(p)}
                className="flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-accent/10"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-gold">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <span className="rounded-md p-2 text-muted-foreground">
                  <Download className="h-4 w-4" />
                </span>
                {isCoach && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePlan(p);
                    }}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isCoach && user && (
        <p className="text-center text-[11px] text-muted-foreground">
          Verknüpft mit Demo-Profil: {user.name}
        </p>
      )}
    </div>
  );
}
