import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createOrgTeam } from "@/lib/organizations/organizations.functions";
import { normalizeTeamDraft, validateTeamDraft } from "@/features/coach-org-detail/lib/team.logic";

export function useOrgTeams({
  orgId,
  orgSport,
  teamLabel,
}: {
  orgId: string;
  orgSport: string | null;
  teamLabel: string;
}) {
  const queryClient = useQueryClient();
  const createTeam = useServerFn(createOrgTeam);
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeTeamDraft({ name, ageGroup });
      return createTeam({
        data: {
          organization_id: orgId,
          name: normalized.name,
          sport: orgSport,
          age_group: normalized.age_group,
        },
      });
    },
    onSuccess: () => {
      setName("");
      setAgeGroup("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["coach-org-detail", orgId] });
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : String(mutationError));
    },
  });

  const submit = () => {
    const validationError = validateTeamDraft({ name, ageGroup }, teamLabel);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    createMutation.mutate();
  };

  return {
    name,
    setName,
    ageGroup,
    setAgeGroup,
    error,
    isCreating: createMutation.isPending,
    submit,
  };
}
