import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/tracker/app/profile")({
  head: () => ({ meta: [{ title: "Profil — BodyFuel Tracker" }] }),
  component: ProfilePage,
});

const GOALS = [
  { v: "fat_loss", l: "Abnehmen" },
  { v: "maintain", l: "Halten" },
  { v: "lean_bulk", l: "Aufbauen" },
];

function ProfilePage() {
  const { supabaseUser, logout } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    height_cm: "",
    birthdate: "",
    gender: "" as "" | "male" | "female" | "other",
    training_goal: "" as "" | "fat_loss" | "maintain" | "lean_bulk",
    goal_weight_kg: "",
    daily_step_goal: "",
  });

  useEffect(() => {
    (async () => {
      if (!supabaseUser) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, height_cm, birthdate, gender, training_goal, goal_weight_kg, daily_step_goal")
        .eq("id", supabaseUser.id)
        .maybeSingle();
      if (data) {
        setForm({
          display_name: data.display_name ?? "",
          height_cm: data.height_cm != null ? String(data.height_cm) : "",
          birthdate: data.birthdate ?? "",
          gender: (data.gender as any) ?? "",
          training_goal: (data.training_goal as any) ?? "",
          goal_weight_kg: data.goal_weight_kg != null ? String(data.goal_weight_kg) : "",
          daily_step_goal: data.daily_step_goal != null ? String(data.daily_step_goal) : "",
        });
      }
      setLoading(false);
    })();
  }, [supabaseUser]);

  const save = async () => {
    if (!supabaseUser) return;
    setSaving(true);
    const payload: any = {
      display_name: form.display_name.trim() || null,
      height_cm: form.height_cm ? Number(form.height_cm.replace(",", ".")) : null,
      birthdate: form.birthdate || null,
      gender: form.gender || null,
      training_goal: form.training_goal || null,
      goal_weight_kg: form.goal_weight_kg ? Number(form.goal_weight_kg.replace(",", ".")) : null,
      daily_step_goal: form.daily_step_goal ? parseInt(form.daily_step_goal, 10) : null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", supabaseUser.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil gespeichert");
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Account</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Profil</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <User className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-semibold">{supabaseUser?.email}</p>
            <p className="text-xs text-muted-foreground">Free User</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="dn">Anzeigename</Label>
            <Input id="dn" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="h">Größe (cm)</Label>
            <Input id="h" type="number" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="bd">Geburtsdatum</Label>
            <Input id="bd" type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} />
          </div>
          <div>
            <Label>Geschlecht</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as any })}>
              <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Männlich</SelectItem>
                <SelectItem value="female">Weiblich</SelectItem>
                <SelectItem value="other">Divers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ziel</Label>
            <Select value={form.training_goal} onValueChange={(v) => setForm({ ...form, training_goal: v as any })}>
              <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
              <SelectContent>
                {GOALS.map((g) => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="gw">Zielgewicht (kg)</Label>
            <Input id="gw" type="number" step="0.1" value={form.goal_weight_kg} onChange={(e) => setForm({ ...form, goal_weight_kg: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="sg">Tägliches Schritteziel</Label>
            <Input id="sg" type="number" value={form.daily_step_goal} onChange={(e) => setForm({ ...form, daily_step_goal: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Speichere…" : "Speichern"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 font-display text-lg font-bold">Sitzung</h2>
        <Button
          variant="outline"
          onClick={async () => { await logout(); navigate({ to: "/tracker" }); }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Abmelden
        </Button>
      </div>
    </div>
  );
}
