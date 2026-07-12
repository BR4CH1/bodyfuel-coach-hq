/**
 * PlayerCardManualEditor — Coach-Editor unter der Karte, um die 6 Stats + OVR
 * manuell einzutragen und die Karte für den Athleten freizugeben.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { savePlayerCardManualOverrides } from "@/lib/player-cards.functions";

type OverrideKey = "BFR" | "SPD" | "ACC" | "AGI" | "POW" | "STR" | "END";
const FIELDS: { key: OverrideKey; label: string }[] = [
  { key: "BFR", label: "OVR" },
  { key: "SPD", label: "SPD" },
  { key: "ACC", label: "ACC" },
  { key: "AGI", label: "AGI" },
  { key: "POW", label: "POW" },
  { key: "STR", label: "STR" },
  { key: "END", label: "END" },
];

export function PlayerCardManualEditor({
  userId,
  initialOverrides,
  isPublished,
  invalidateKey,
}: {
  userId: string;
  initialOverrides?: Partial<Record<OverrideKey, number | null>> | null;
  isPublished?: boolean;
  invalidateKey: (string | number)[];
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(savePlayerCardManualOverrides);
  const [values, setValues] = useState<Record<OverrideKey, string>>(() => ({
    BFR: initialOverrides?.BFR?.toString() ?? "",
    SPD: initialOverrides?.SPD?.toString() ?? "",
    ACC: initialOverrides?.ACC?.toString() ?? "",
    AGI: initialOverrides?.AGI?.toString() ?? "",
    POW: initialOverrides?.POW?.toString() ?? "",
    STR: initialOverrides?.STR?.toString() ?? "",
    END: initialOverrides?.END?.toString() ?? "",
  }));
  const [published, setPublished] = useState(!!isPublished);

  // Wenn sich der geladene Datensatz ändert, Felder synchron halten.
  useEffect(() => {
    setValues({
      BFR: initialOverrides?.BFR?.toString() ?? "",
      SPD: initialOverrides?.SPD?.toString() ?? "",
      ACC: initialOverrides?.ACC?.toString() ?? "",
      AGI: initialOverrides?.AGI?.toString() ?? "",
      POW: initialOverrides?.POW?.toString() ?? "",
      STR: initialOverrides?.STR?.toString() ?? "",
      END: initialOverrides?.END?.toString() ?? "",
    });
    setPublished(!!isPublished);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialOverrides?.BFR, initialOverrides?.SPD, initialOverrides?.ACC,
    initialOverrides?.AGI, initialOverrides?.POW, initialOverrides?.STR,
    initialOverrides?.END, isPublished,
  ]);

  const save = useMutation({
    mutationFn: async (payload: { publish?: boolean }) => {
      const overrides: Partial<Record<OverrideKey, number | null>> = {};
      for (const f of FIELDS) {
        const v = values[f.key].trim();
        overrides[f.key] = v === "" ? null : Math.max(0, Math.min(99, Number(v)));
      }
      return await saveFn({
        data: {
          user_id: userId,
          overrides,
          is_published: typeof payload.publish === "boolean" ? payload.publish : published,
        },
      });
    },
    onSuccess: (_r, vars) => {
      toast.success(vars.publish === true ? "Karte freigegeben" : vars.publish === false ? "Karte ausgeblendet" : "Werte gespeichert");
      qc.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bulls-red">
            Werte eintragen
          </div>
          <div className="text-xs text-muted-foreground">
            Coach-Overrides — leer lassen für „—" auf der Karte.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !published;
            setPublished(next);
            save.mutate({ publish: next });
          }}
          disabled={save.isPending}
          className={
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 " +
            (published
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
              : "border-border bg-card text-muted-foreground hover:border-bulls-red/60 hover:text-white")
          }
        >
          {published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {published ? "Für Athlet sichtbar" : "Nicht freigegeben"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {f.label}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              placeholder="—"
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="h-10 w-full rounded-lg border border-border bg-background px-2 text-center font-mono text-lg font-bold text-white outline-none focus:border-bulls-red/60"
            />
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => save.mutate({})}
          disabled={save.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Werte speichern
        </button>
      </div>
    </div>
  );
}
