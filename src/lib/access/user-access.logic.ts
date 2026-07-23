export type ContextMembership = {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: string;
  staffRole: string | null;
  membershipStatus: string;
};

export type AvailableContext =
  | { type: "personal_bodyfuel"; label: string; contextKey: "personal" }
  | {
      type: "organization";
      organizationId: string;
      organizationSlug: string;
      label: string;
      role: string;
      mode: "athlete" | "staff";
      contextKey: string;
    };

const LEGACY_STAFF_MEMBERSHIP_ROLES = new Set([
  "coach",
  "organization_admin",
  "head_coach",
  "team_coach",
  "performance_coach",
  "nutrition_coach",
  "community_manager",
  "staff",
]);

/**
 * Baut auswählbare Portalkontexte additiv auf.
 *
 * Eine Organisation darf gleichzeitig einen Athleten- und einen Coach-Kontext
 * liefern. Es gibt bewusst keine Rollenpriorität und keine Deduplizierung nur
 * nach organizationId.
 */
export function buildAvailableContexts(
  personalBodyfuelAccess: boolean,
  memberships: ReadonlyArray<ContextMembership>,
): AvailableContext[] {
  const contexts: AvailableContext[] = [];

  if (personalBodyfuelAccess) {
    contexts.push({
      type: "personal_bodyfuel",
      label: "Mein BODYFUEL",
      contextKey: "personal",
    });
  }

  for (const membership of memberships) {
    const membershipIsActive = membership.membershipStatus === "active";

    if (membershipIsActive && membership.role === "athlete") {
      contexts.push({
        type: "organization",
        organizationId: membership.organizationId,
        organizationSlug: membership.organizationSlug,
        label: `${membership.organizationName} – Athlet`,
        role: "athlete",
        mode: "athlete",
        contextKey: `organization:${membership.organizationId}:role:athlete`,
      });
    }

    // Eine echte staff_assignments-Zeile ist unabhängig vom Status einer
    // optionalen neutralen/alten Membership ein gültiger Staff-Zugriff.
    const effectiveStaffRole =
      membership.staffRole ??
      (membershipIsActive && LEGACY_STAFF_MEMBERSHIP_ROLES.has(membership.role)
        ? membership.role
        : null);

    if (effectiveStaffRole) {
      contexts.push({
        type: "organization",
        organizationId: membership.organizationId,
        organizationSlug: membership.organizationSlug,
        label: `${membership.organizationName} – Coach`,
        role: effectiveStaffRole,
        mode: "staff",
        contextKey: `organization:${membership.organizationId}:role:staff`,
      });
    }
  }

  return contexts;
}
