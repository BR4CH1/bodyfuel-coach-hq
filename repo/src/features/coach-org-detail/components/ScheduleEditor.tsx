import { useState } from "react";
import {
  buildScheduleRows,
  createScheduleKey,
  serializeScheduleRows,
  WEEKDAYS,
} from "../lib/schedule.logic";
import type { ScheduleEntry, ScheduleRow } from "../types";

export function ScheduleEditor(props: {
  teamId: string | null;
  entries: ScheduleEntry[];
  onSave: (rows: ReturnType<typeof serializeScheduleRows>) => void;
  saving: boolean;
}) {
  return <ScheduleEditorForm key={createScheduleKey(props.teamId, props.entries)} {...props} />;
}

function ScheduleEditorForm({
  teamId,
  entries,
  onSave,
  saving,
}: {
  teamId: string | null;
  entries: ScheduleEntry[];
  onSave: (rows: ReturnType<typeof serializeScheduleRows>) => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState<ScheduleRow[]>(() => buildScheduleRows(entries));

  const patch = (weekday: number, patchValue: Partial<ScheduleRow>) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.weekday === weekday ? { ...row, ...patchValue } : row)),
    );
  };

  return (
    <div className="space-y-2">
      <div className="hidden gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[80px_1fr_80px_80px_80px_60px]">
        <div>Tag</div>
        <div>Titel</div>
        <div>Start</div>
        <div>Ende</div>
        <div>Status</div>
        <div />
      </div>

      {rows.map((row) => (
        <div
          key={row.weekday}
          className="grid grid-cols-2 gap-2 border-b border-border py-2 text-sm sm:grid-cols-[80px_1fr_80px_80px_80px_60px] sm:items-center"
        >
          <div className="font-semibold sm:col-span-1">{WEEKDAYS[row.weekday]}</div>
          <input
            value={row.title}
            onChange={(event) => patch(row.weekday, { title: event.target.value })}
            className="col-span-2 rounded border border-border bg-background px-2 py-1 text-xs sm:col-span-1"
            placeholder="Team Training"
          />
          <input
            type="time"
            value={row.start_time}
            onChange={(event) => patch(row.weekday, { start_time: event.target.value })}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <input
            type="time"
            value={row.end_time}
            onChange={(event) => patch(row.weekday, { end_time: event.target.value })}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => patch(row.weekday, { active: !row.active })}
            className={`rounded px-2 py-1 text-[10px] uppercase tracking-wider ${
              row.active ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
            }`}
          >
            {row.active ? "aktiv" : "inaktiv"}
          </button>
          <div />
        </div>
      ))}

      <div className="flex justify-end pt-2">
        <button
          disabled={saving || !teamId}
          onClick={() => onSave(serializeScheduleRows(rows, entries))}
          className="rounded bg-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Schedule speichern"}
        </button>
      </div>
    </div>
  );
}
