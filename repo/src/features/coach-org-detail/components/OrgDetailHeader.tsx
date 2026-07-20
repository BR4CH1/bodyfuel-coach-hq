import { Link } from "@tanstack/react-router";
import bullsLogo from "@/assets/bodyfuel-bulls-logo.png.asset.json";
import { OrgLicenseChip } from "@/components/organizations/OrgLicenseChip";
import type { OrgDetailOrganization } from "@/features/coach-org-detail/types";

export function OrgDetailHeader({
  org,
  isBulls,
  experienceLabel,
}: {
  org: OrgDetailOrganization;
  isBulls: boolean;
  experienceLabel: string;
}) {
  return (
    <>
      <div className="mb-3">
        <Link
          to="/coach/teams"
          className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          ← Teams
        </Link>
      </div>

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[#252525] bg-[#0f0f0f] p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-bulls-red">
            <span className="truncate">{org.name}</span>
            <span>·</span>
            <span className="text-neutral-400">{experienceLabel}</span>
            {org.status === "active" && (
              <span
                title="Active"
                className="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
              />
            )}
          </div>
          <h1 className="mt-1 truncate font-display text-2xl font-bold text-white sm:text-3xl">
            Coach Dashboard
          </h1>
          <div className="mt-2">
            <OrgLicenseChip
              plan={org.license_plan}
              status={org.license_status}
              startedAt={org.license_started_at}
              expiresAt={org.license_expires_at}
              maxCustomers={org.max_customers}
              maxCoaches={org.max_coaches}
            />
          </div>
        </div>
        <OrganizationLogo org={org} isBulls={isBulls} />
      </header>
    </>
  );
}

function OrganizationLogo({ org, isBulls }: { org: OrgDetailOrganization; isBulls: boolean }) {
  if (org.logo_url) {
    return (
      <img
        src={org.logo_url}
        alt={org.name}
        className="h-12 w-12 shrink-0 rounded-lg object-cover sm:h-14 sm:w-14"
      />
    );
  }

  if (isBulls) {
    return (
      <img
        src={bullsLogo.url}
        alt={org.name}
        className="h-12 w-12 shrink-0 rounded-lg object-contain sm:h-14 sm:w-14"
      />
    );
  }

  return (
    <div
      className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-sm font-bold text-white sm:h-14 sm:w-14"
      style={{ background: org.primary_color ?? "#333" }}
    >
      {org.name.slice(0, 2).toUpperCase()}
    </div>
  );
}
