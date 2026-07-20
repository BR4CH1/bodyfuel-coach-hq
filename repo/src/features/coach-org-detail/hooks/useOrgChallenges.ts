import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  createOrgChallenge,
  listOrgChallenges,
} from "@/lib/organizations/operating-loop.functions";
import {
  buildChallengePayload,
  createEmptyChallengeDraft,
  splitChallenges,
  validateChallengeDraft,
} from "@/features/coach-org-detail/lib/community.logic";
import type { ChallengeDraft, OrgChallenge } from "@/features/coach-org-detail/types";

export function useOrgChallenges(orgId: string) {
  const queryClient = useQueryClient();
  const listChallenges = useServerFn(listOrgChallenges);
  const createChallenge = useServerFn(createOrgChallenge);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draft, setDraft] = useState<ChallengeDraft>(() => createEmptyChallengeDraft());
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const challengeQuery = useQuery({
    queryKey: ["org-challenges", orgId],
    queryFn: async () => {
      const response = await listChallenges({ data: { organization_id: orgId } });
      return response.challenges as OrgChallenge[];
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createChallenge({ data: buildChallengePayload(draft, orgId) }),
    onSuccess: (response) => {
      setShowCreateForm(false);
      setDraft(createEmptyChallengeDraft());
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["org-challenges", orgId] });
      if (response.id) setSelectedChallengeId(response.id);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : String(mutationError));
    },
  });

  const groups = useMemo(() => splitChallenges(challengeQuery.data ?? []), [challengeQuery.data]);

  const updateDraft = (patch: Partial<ChallengeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = () => {
    const validationError = validateChallengeDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    createMutation.mutate();
  };

  return {
    groups,
    isLoading: challengeQuery.isLoading,
    isCreating: createMutation.isPending,
    showCreateForm,
    setShowCreateForm,
    draft,
    updateDraft,
    submit,
    error,
    selectedChallengeId,
    setSelectedChallengeId,
  };
}
