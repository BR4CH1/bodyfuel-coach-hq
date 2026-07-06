import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Users, MessageSquarePlus, Megaphone, Trophy, Dumbbell, Star } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrgHomeData } from "@/lib/organizations/athlete.functions";
import { listOrgCommunityPosts, createOrgCommunityPost } from "@/lib/organizations/operating-loop.functions";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/community")({
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
  const qc = useQueryClient();
  const fetchHome = useServerFn(getOrgHomeData);
  const fetchPosts = useServerFn(listOrgCommunityPosts);
  const createPost = useServerFn(createOrgCommunityPost);
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("general");

  const { data: home } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });
  const { data: feed } = useQuery({
    queryKey: ["org-community", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchPosts({ data: { slug: org.slug } }),
  });

  const createMut = useMutation({
    mutationFn: (input: { content: string; post_type: string }) =>
      createPost({ data: { organization_id: (feed as any)?.org?.id, content: input.content, post_type: input.post_type } }),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["org-community", org.slug] });
    },
  });

  const primary = org.primary_color ?? "#e11d48";
  const posts = (feed?.posts as any[]) ?? [];
  const canPost = feed?.can_post ?? false;
  const isStaff = feed?.is_staff ?? false;

  return (
    <OrgAthleteLayout slug={org.slug} features={(home?.features as any) ?? []} primaryColor={primary}>
      <header className="px-5 py-6 text-white" style={{ background: `linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)` }}>
        <Link to="/$orgSlug/home" params={{ orgSlug: org.slug }} className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
          <ChevronLeft className="h-3 w-3" /> Home
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{org.name}</div>
        <h1 className="font-display text-2xl font-bold">Community</h1>
      </header>

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
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => content.trim() && createMut.mutate({ content: content.trim(), post_type: isStaff ? postType : "general" })}
                disabled={!content.trim() || createMut.isPending}
                className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                <MessageSquarePlus className="h-3 w-3" /> Posten
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
                  <div className="mt-2 whitespace-pre-wrap text-sm">{p.content}</div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </OrgAthleteLayout>
  );
}
