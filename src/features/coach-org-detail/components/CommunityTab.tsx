import { Empty } from "@/features/coach-org-detail/components/OrgDetailPrimitives";
import { useOrgCommunity } from "@/features/coach-org-detail/hooks/useOrgCommunity";
import { COMMUNITY_POST_TYPES } from "@/features/coach-org-detail/lib/community.logic";
import type { CommunityPostType } from "@/features/coach-org-detail/types";

export function CommunityTab({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const community = useOrgCommunity({ orgId, orgSlug });

  if (!orgSlug) return <Empty>Community-Feed lädt…</Empty>;

  return (
    <div className="space-y-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          community.submit();
        }}
        className="rounded-lg border border-border bg-card p-3"
      >
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Neuer Beitrag
        </div>
        <select
          value={community.draft.postType}
          onChange={(event) => community.setPostType(event.target.value as CommunityPostType)}
          className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
        >
          {COMMUNITY_POST_TYPES.map((postType) => (
            <option key={postType} value={postType}>
              {postType}
            </option>
          ))}
        </select>
        <textarea
          value={community.draft.content}
          onChange={(event) => community.setContent(event.target.value)}
          rows={3}
          maxLength={5000}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          placeholder="Inhalt"
        />
        <div className="mt-1 text-right text-[10px] text-muted-foreground">
          {community.draft.content.length}/5000
        </div>
        {community.error && <div className="mt-2 text-xs text-red-500">{community.error}</div>}
        <button
          type="submit"
          disabled={!community.draft.content.trim() || community.isPosting}
          className="mt-2 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {community.isPosting ? "Wird gepostet…" : "Posten"}
        </button>
      </form>

      {community.isLoading ? (
        <Empty>Beiträge werden geladen…</Empty>
      ) : community.posts.length === 0 ? (
        <Empty>Noch keine Beiträge.</Empty>
      ) : (
        <ul className="space-y-2">
          {community.posts.map((post) => (
            <li key={post.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="truncate font-semibold">{post.author_name}</span>
                <span className="shrink-0">
                  {new Date(post.created_at).toLocaleString("de-DE")}
                </span>
              </div>
              <div className="mt-1 whitespace-pre-wrap">{post.content}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
