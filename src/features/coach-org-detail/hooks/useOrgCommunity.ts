import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  createOrgCommunityPost,
  listOrgCommunityPosts,
} from "@/lib/organizations/operating-loop.functions";
import {
  normalizeCommunityPostDraft,
  validateCommunityPostDraft,
} from "@/features/coach-org-detail/lib/community.logic";
import type {
  CommunityPost,
  CommunityPostDraft,
  CommunityPostType,
} from "@/features/coach-org-detail/types";

export function useOrgCommunity({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const queryClient = useQueryClient();
  const listPosts = useServerFn(listOrgCommunityPosts);
  const createPost = useServerFn(createOrgCommunityPost);
  const [draft, setDraft] = useState<CommunityPostDraft>({
    content: "",
    postType: "staff_update",
  });
  const [error, setError] = useState<string | null>(null);

  const postQuery = useQuery({
    queryKey: ["org-community-coach", orgId],
    queryFn: async () => {
      const response = await listPosts({ data: { slug: orgSlug } });
      return response.posts as CommunityPost[];
    },
    enabled: Boolean(orgSlug),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const normalized = normalizeCommunityPostDraft(draft);
      return createPost({
        data: {
          organization_id: orgId,
          content: normalized.content,
          post_type: normalized.post_type,
        },
      });
    },
    onSuccess: () => {
      setDraft((current) => ({ ...current, content: "" }));
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["org-community-coach", orgId] });
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : String(mutationError));
    },
  });

  const setContent = (content: string) => setDraft((current) => ({ ...current, content }));
  const setPostType = (postType: CommunityPostType) =>
    setDraft((current) => ({ ...current, postType }));

  const submit = () => {
    const validationError = validateCommunityPostDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    createMutation.mutate();
  };

  return {
    posts: postQuery.data ?? [],
    isLoading: postQuery.isLoading,
    draft,
    setContent,
    setPostType,
    submit,
    isPosting: createMutation.isPending,
    error,
  };
}
