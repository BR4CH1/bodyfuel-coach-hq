import { PERMISSION_LABELS, type PermissionKey } from "@/lib/organizations/staff-labels";
import { STAFF_PERMISSION_KEYS } from "../lib/staff.logic";

type PermissionChecklistProps = {
  permissions: readonly PermissionKey[];
  onToggle: (permission: PermissionKey) => void;
};

export function PermissionChecklist({ permissions, onToggle }: PermissionChecklistProps) {
  return (
    <ul className="space-y-2">
      {STAFF_PERMISSION_KEYS.map((permission) => (
        <li key={permission} className="rounded border border-border bg-background p-2">
          <label className="flex cursor-pointer items-start gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={permissions.includes(permission)}
              onChange={() => onToggle(permission)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">{PERMISSION_LABELS[permission].label}</span>
              <span className="block text-[10px] text-muted-foreground">
                {PERMISSION_LABELS[permission].description}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
