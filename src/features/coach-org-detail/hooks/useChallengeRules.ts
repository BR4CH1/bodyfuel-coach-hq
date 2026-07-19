import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  awardChallengeBonus,
  listChallengeRules,
  upsertChallengeRule,
} from "@/lib/organizations/operating-loop.functions";
import {
  normalizeChallengeRuleDraft,
  validateChallengeRuleDraft,
} from "@/features/coach-org-detail/lib/community.logic";
import type {
  ChallengeBonusDraft,
  ChallengeRule,
  ChallengeRuleDraft,
} from "@/features/coach-org-detail/types";

const EMPTY_RULE_DRAFT: ChallengeRuleDraft = {
  ruleType: "daily_checkin",
  title: "",
  points: 2,
  frequency: "daily",
};

const EMPTY_BONUS_DRAFT: ChallengeBonusDraft = {
  userId: "",
  points: 5,
  reason: "",
};

export function useChallengeRules(challengeId: string) {
  const queryClient = useQueryClient();
  const listRules = useServerFn(listChallengeRules);
  const saveRule = useServerFn(upsertChallengeRule);
  const awardBonus = useServerFn(awardChallengeBonus);
  const [ruleDraft, setRuleDraft] = useState<ChallengeRuleDraft>(EMPTY_RULE_DRAFT);
  const [bonusDraft, setBonusDraft] = useState<ChallengeBonusDraft>(EMPTY_BONUS_DRAFT);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [bonusError, setBonusError] = useState<string | null>(null);
  const [bonusSuccess, setBonusSuccess] = useState<string | null>(null);

  const rulesQuery = useQuery({
    queryKey: ["challenge-rules", challengeId],
    queryFn: async () => {
      const response = await listRules({ data: { challenge_id: challengeId } });
      return response.rules as ChallengeRule[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => saveRule({ data: normalizeChallengeRuleDraft(ruleDraft, challengeId) }),
    onSuccess: () => {
      setRuleDraft(EMPTY_RULE_DRAFT);
      setRuleError(null);
      queryClient.invalidateQueries({ queryKey: ["challenge-rules", challengeId] });
      queryClient.invalidateQueries({ queryKey: ["org-challenges"] });
    },
    onError: (mutationError: unknown) => {
      setRuleError(mutationError instanceof Error ? mutationError.message : String(mutationError));
    },
  });

  const bonusMutation = useMutation({
    mutationFn: () =>
      awardBonus({
        data: {
          challenge_id: challengeId,
          user_id: bonusDraft.userId.trim(),
          points: Math.round(bonusDraft.points),
          reason: bonusDraft.reason.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setBonusDraft(EMPTY_BONUS_DRAFT);
      setBonusError(null);
      setBonusSuccess("Bonus wurde vergeben.");
    },
    onError: (mutationError: unknown) => {
      setBonusSuccess(null);
      setBonusError(mutationError instanceof Error ? mutationError.message : String(mutationError));
    },
  });

  const updateRuleDraft = (patch: Partial<ChallengeRuleDraft>) => {
    setRuleDraft((current) => ({ ...current, ...patch }));
  };

  const updateBonusDraft = (patch: Partial<ChallengeBonusDraft>) => {
    setBonusDraft((current) => ({ ...current, ...patch }));
  };

  const submitRule = () => {
    const validationError = validateChallengeRuleDraft(ruleDraft);
    if (validationError) {
      setRuleError(validationError);
      return;
    }
    setRuleError(null);
    saveMutation.mutate();
  };

  const submitBonus = () => {
    if (!bonusDraft.userId.trim()) {
      setBonusError("Bitte eine User-ID eingeben.");
      return;
    }
    if (!Number.isFinite(bonusDraft.points) || bonusDraft.points === 0) {
      setBonusError("Die Bonuspunkte dürfen nicht 0 sein.");
      return;
    }
    setBonusError(null);
    setBonusSuccess(null);
    bonusMutation.mutate();
  };

  return {
    rules: rulesQuery.data ?? [],
    isLoading: rulesQuery.isLoading,
    ruleDraft,
    updateRuleDraft,
    submitRule,
    isSavingRule: saveMutation.isPending,
    ruleError,
    bonusDraft,
    updateBonusDraft,
    submitBonus,
    isAwardingBonus: bonusMutation.isPending,
    bonusError,
    bonusSuccess,
  };
}
