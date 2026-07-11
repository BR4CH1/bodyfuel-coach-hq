import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Users, MessageSquarePlus, Megaphone, Trophy, Dumbbell, Star, ImagePlus, X, Flame, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { useSession } from "@/lib/bodyfuel/session";
import { getOrgHomeData } from "@/lib/organizations/athlete.functions";
import {
  listOrgCommunityPosts,
  createOrgCommunityPost,
} from "@/lib/organizations/operating-loop.functions";
import {
  getOrgMonthlyRanking,
  getOrgMyScore,
  getOrgHallOfFame,
} from "@/lib/organizations/ranking.functions";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { Route as OrgLayoutRoute } from "./$orgSlug";

const CATEGORY_LABEL: Record<string, string> = {
  training: "Training",
  team_training: "Teamtraining",
  nutrition: "Ernährung",
  check_in: "Check-in",
  tasks: "Aufgaben",
  recovery: "Recovery",
  rehab: "Rehab",
  development: "Entwicklung",
  challenge: "Challenge",
  streak: "Streak",
};

const MONTH_LABEL_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

type TabKey = "feed" | "ranking";

export const Route = createFileRoute("/$orgSlug/community")({
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => {
    const t = s.tab === "ranking" ? "ranking" : s.tab === "feed" ? "feed" : undefined;
    return t ? { tab: t } : {};
  },
  component: OrgCommunity,
});

const POST_TYPE_LABEL: Record<string, string> = {
  general: "Post",
  staff_update: "Staff Update",
  announcement: "Ankündigung",
  training: "Training",
  challenge: "Challenge",
  achievement: "Erfolg",
};

const POST_TYPE_ICON: Record<string, any> = {
  announcement: Megaphone,
  staff_update: Megaphone,
  training: Dumbbell,
  challenge: Trophy,
  achievement: Star,
};

function OrgCommunity() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser } = useSession();
  const search = Route.useSearch();
  const [tab, setTab] = useState<TabKey>(search.tab ?? "feed");
  const fetchHome = useServerFn(getOrgHomeData);

  const { data: home } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });

  const primary = org.primary_color ?? "#e11d48";

  return (
    <OrgAthleteLayout slug={org.slug} features={(home?.features as any) ?? []} primaryColor={primary}>
      <header
        className="px-5 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)` }}
      >
        <Link
          to="/$orgSlug/home"
          params={{ orgSlug: org.slug }}
          className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80"
        >
          <ChevronLeft className="h-3 w-3" /> Home
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{org.name}</div>
        <h1 className="font-display text-2xl font-bold">Community</h1>
      </header>

      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-2">
          {(["feed", "ranking"] as const).map((k) => {
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="relative py-3 text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: active ? primary : undefined }}
              >
                <span className={active ? "" : "text-muted-foreground"}>
                  {k === "feed" ? "Feed" : "Ranking"}
                </span>
                {active && (
                  <span
                    className="absolute inset-x-6 -bottom-px h-0.5 rounded-full"
                    style={{ background: primary }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "feed" ? <FeedPane primary={primary} /> : <RankingPane primary={primary} />}
    </OrgAthleteLayout>
  );
}

function FeedPane({ primary }: { primary: string }) {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser } = useSession();
  const qc = useQueryClient();
  const fetchPosts = useServerFn(listOrgCommunityPosts);
  const createPost = useServerFn(createOrgCommunityPost);
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("general");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: feed } = useQuery({
    queryKey: ["org-community", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchPosts({ data: { slug: org.slug } }),
  });

  const orgId = (feed as any)?.org?.id as string | undefined;

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setUploadError("Bitte ein Bild auswählen.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setUploadError("Maximal 8 MB pro Bild.");
      return;
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }

  const createMut = useMutation({
    mutationFn: async (input: { content: string; post_type: string }) => {
      if (!orgId || !supabaseUser?.id) throw new Error("Kein Zugriff");
      let image_path: string | null = null;
      if (imageFile) {
        const ext = (imageFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${orgId}/${supabaseUser.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("community-photos")
          .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
        if (upErr) throw new Error(upErr.message);
        image_path = path;
      }
      return createPost({
        data: {
          organization_id: orgId,
          content: input.content,
          post_type: input.post_type,
          image_path,
        },
      });
    },
    onSuccess: () => {
      setContent("");
      clearImage();
      qc.invalidateQueries({ queryKey: ["org-community", org.slug] });
    },
    onError: (e: any) => setUploadError(e?.message ?? "Fehler beim Posten"),
  });

  const posts = (feed?.posts as any[]) ?? [];
  const canPost = feed?.can_post ?? false;
  const isStaff = feed?.is_staff ?? false;
  const hasBody = !!content.trim() || !!imageFile;

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-5">
      {canPost && (
        <div className="rounded-lg border border-border bg-card p-3">
          {isStaff && (
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="general">Post</option>
              <option value="staff_update">Staff Update</option>
              <option value="announcement">Ankündigung</option>
              <option value="training">Training</option>
              <option value="challenge">Challenge</option>
              <option value="achievement">Erfolg</option>
            </select>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Was möchtest du teilen?"
            rows={3}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          />
          {imagePreview && (
            <div className="relative mt-2">
              <img src={imagePreview} alt="Vorschau" className="max-h-64 w-full rounded object-cover" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"
                aria-label="Foto entfernen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {uploadError && <div className="mt-2 text-xs text-rose-500">{uploadError}</div>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              <ImagePlus className="h-3.5 w-3.5" />
              Foto
              <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </label>
            <button
              onClick={() =>
                hasBody &&
                createMut.mutate({
                  content: content.trim(),
                  post_type: isStaff ? postType : "general",
                })
              }
              disabled={!hasBody || createMut.isPending}
              className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <MessageSquarePlus className="h-3 w-3" /> {createMut.isPending ? "Posten…" : "Posten"}
            </button>
          </div>
        </div>
      )}


      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Noch keine Beiträge in der Community.
        </div>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => {
            const Icon = POST_TYPE_ICON[p.post_type] ?? Users;
            return (
              <li key={p.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-xs">
                  <div
                    className="grid h-6 w-6 place-items-center rounded-full text-white"
                    style={{ background: primary }}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="font-semibold">{p.author_name}</div>
                  <div className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {POST_TYPE_LABEL[p.post_type] ?? p.post_type}
                  </div>
                  <div className="ml-auto text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("de-DE")}
                  </div>
                </div>
                {p.content && <div className="mt-2 whitespace-pre-wrap text-sm">{p.content}</div>}
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt="Community-Foto"
                    className="mt-2 max-h-96 w-full rounded object-cover"
                    loading="lazy"
                  />
                )}
              </li>
            );
          })}

        </ul>
      )}
    </main>
  );
}

function RankingPane({ primary }: { primary: string }) {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser } = useSession();
  const fetchRanking = useServerFn(getOrgChallengeRanking);
  const { data } = useQuery({
    queryKey: ["org-ranking-ledger", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchRanking({ data: { slug: org.slug } }),
  });

  if (!data) return <div className="p-6 text-center text-sm text-muted-foreground">Laden…</div>;

  const entries = (data.entries as any[]) ?? [];
  const active = (data as any).active_challenge;
  const past = ((data as any).past_challenges ?? []) as any[];

  return (
    <main className="mx-auto max-w-md px-4 py-5">
      {active && (
        <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">Aktive Challenge: </span>
          <span className="font-semibold">{active.name}</span>
        </div>
      )}
      {!active ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="font-semibold">Aktuell läuft keine Team-Challenge.</p>
          <p className="mt-2 text-xs">
            Sobald deine Organisation eine neue Challenge startet, erscheint hier die Rangliste.
          </p>
          {past.length > 0 && (
            <div className="mt-6 text-left">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Abgeschlossene Challenges
              </div>
              <ul className="space-y-1 text-xs">
                {past.map((p) => (
                  <li key={p.id} className="rounded border border-border bg-card p-2">
                    <div className="font-semibold">{p.name}</div>
                    {p.ends_at && (
                      <div className="text-muted-foreground">
                        bis {new Date(p.ends_at).toLocaleDateString("de-DE")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Noch keine Punkte in dieser Challenge. Sei die*der Erste!
        </div>
      ) : (
        <ul className="space-y-1">
          {entries.map((e, i) => {
            const isMe = e.user_id === supabaseUser?.id;
            return (
              <li
                key={e.user_id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isMe ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div
                  className="grid h-8 w-8 place-items-center rounded-full font-display text-sm font-bold"
                  style={{ background: i < 3 ? primary : "hsl(var(--muted))", color: i < 3 ? "#fff" : undefined }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 text-sm font-semibold">{isMe ? "Du" : e.name}</div>
                <div className="font-display text-sm font-bold">{e.points}</div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
