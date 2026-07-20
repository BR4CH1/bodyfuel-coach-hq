import { useChallengeRules } from "@/features/coach-org-detail/hooks/useChallengeRules";
import {
  CHALLENGE_FREQUENCIES,
  CHALLENGE_RULE_TYPES,
} from "@/features/coach-org-detail/lib/community.logic";

export function ChallengeRuleEditor({
  challengeId,
  onClose,
}: {
  challengeId: string;
  onClose: () => void;
}) {
  const editor = useChallengeRules(challengeId);

  return (
    <div className="rounded-lg border border-primary bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Punkte-Regeln
        </div>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground">
          ✕
        </button>
      </div>

      {editor.isLoading ? (
        <div className="mb-3 text-xs text-muted-foreground">Regeln werden geladen…</div>
      ) : (
        <ul className="mb-3 space-y-1 text-sm">
          {editor.rules.map((rule) => (
            <li
              key={rule.id}
              className="flex justify-between gap-3 rounded border border-border bg-background px-2 py-1"
            >
              <span className="min-w-0 truncate">
                {rule.title} <span className="text-muted-foreground">({rule.rule_type})</span>
              </span>
              <span className="shrink-0 font-semibold">
                +{rule.points} · {rule.frequency}
              </span>
            </li>
          ))}
          {editor.rules.length === 0 && (
            <li className="text-xs text-muted-foreground">Noch keine Regeln.</li>
          )}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          editor.submitRule();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={editor.ruleDraft.ruleType}
            onChange={(event) => editor.updateRuleDraft({ ruleType: event.target.value })}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          >
            {CHALLENGE_RULE_TYPES.map((ruleType) => (
              <option key={ruleType} value={ruleType}>
                {ruleType}
              </option>
            ))}
          </select>
          <select
            value={editor.ruleDraft.frequency}
            onChange={(event) => editor.updateRuleDraft({ frequency: event.target.value })}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          >
            {CHALLENGE_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </select>
          <input
            value={editor.ruleDraft.title}
            onChange={(event) => editor.updateRuleDraft({ title: event.target.value })}
            placeholder="Titel"
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <input
            type="number"
            min={1}
            value={editor.ruleDraft.points}
            onChange={(event) =>
              editor.updateRuleDraft({ points: Number.parseInt(event.target.value, 10) || 0 })
            }
            placeholder="Punkte"
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
        {editor.ruleError && <div className="mt-2 text-xs text-red-500">{editor.ruleError}</div>}
        <button
          type="submit"
          disabled={editor.isSavingRule}
          className="mt-2 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {editor.isSavingRule ? "Wird gespeichert…" : "Regel speichern"}
        </button>
      </form>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          editor.submitBonus();
        }}
        className="mt-4 border-t border-border pt-3"
      >
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Manueller Bonus
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={editor.bonusDraft.userId}
            onChange={(event) => editor.updateBonusDraft({ userId: event.target.value })}
            placeholder="User-ID"
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <input
            type="number"
            value={editor.bonusDraft.points}
            onChange={(event) =>
              editor.updateBonusDraft({ points: Number.parseInt(event.target.value, 10) || 0 })
            }
            placeholder="Punkte"
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <input
            value={editor.bonusDraft.reason}
            onChange={(event) => editor.updateBonusDraft({ reason: event.target.value })}
            placeholder="Grund"
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
        </div>
        {editor.bonusError && <div className="mt-2 text-xs text-red-500">{editor.bonusError}</div>}
        {editor.bonusSuccess && (
          <div className="mt-2 text-xs text-emerald-500">{editor.bonusSuccess}</div>
        )}
        <button
          type="submit"
          disabled={!editor.bonusDraft.userId.trim() || editor.isAwardingBonus}
          className="mt-2 rounded border border-border px-3 py-1 text-xs disabled:opacity-50"
        >
          {editor.isAwardingBonus ? "Wird vergeben…" : "Bonus vergeben"}
        </button>
      </form>
    </div>
  );
}
