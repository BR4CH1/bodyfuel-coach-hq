import { buildCoachBriefing } from "@/features/coach-dashboard/lib/coach-briefing.logic";
import { buildCoachDashboardViewModel } from "@/features/coach-dashboard/lib/coach-dashboard.logic";
import { buildCoachIntelligence } from "@/features/coach-dashboard/lib/coach-intelligence.logic";
import { buildCoachWorkload } from "@/features/coach-dashboard/lib/coach-workload.logic";
import type { CoachDashboardData } from "@/features/coach-dashboard/types";

export function buildCoachAgentReport(data: CoachDashboardData, now = new Date()) {
  const view = buildCoachDashboardViewModel(data.clients, now);
  const briefing = buildCoachBriefing({
    view,
    leads: data.leads,
    performancePending: 0,
    showPerformanceNavigation: false,
  });
  const workload = buildCoachWorkload(view, data.leads);
  const intelligence = buildCoachIntelligence(view, data.clients);

  return { view, briefing, workload, intelligence };
}

export function buildBusinessSummaryPayload(data: CoachDashboardData, now = new Date()) {
  const { view, briefing, workload } = buildCoachAgentReport(data, now);

  return {
    generatedAt: now.toISOString(),
    products: data.productCounts,
    leads: { open: data.leads.length },
    coaching: {
      openCheckins: view.openWeek.length,
      expiringPlans: view.expiringPlans.length,
      inactiveCustomers: view.inactive.length,
      riskCustomers: view.redClients.length,
    },
    workload: { state: workload.state, total: workload.total },
    briefing: {
      state: briefing.state,
      title: briefing.title,
      summary: briefing.summary,
    },
  };
}

export function buildOpenTasksPayload(
  data: CoachDashboardData,
  options: { limit: number; now?: Date },
) {
  const now = options.now ?? new Date();
  const { briefing, workload, intelligence } = buildCoachAgentReport(data, now);
  const priority = new Map(["risk", "plan", "lead", "checkin"].map((key, i) => [key, i]));
  const tasks = workload.metrics
    .flatMap((metric) =>
      metric.items.map((item) => ({
        id: item.sourceSignalId,
        category: metric.key,
        customerOrLead: item.name,
        reason: item.reason,
        target: item.target,
      })),
    )
    .sort(
      (left, right) => (priority.get(left.category) ?? 99) - (priority.get(right.category) ?? 99),
    )
    .slice(0, options.limit);

  return {
    generatedAt: now.toISOString(),
    title: briefing.title,
    summary: briefing.summary,
    openTotal: workload.total,
    returned: tasks.length,
    tasks,
    intelligence: {
      stagnating: intelligence.stagnating.length,
      atRisk: intelligence.atRisk.length,
      needsAttention: intelligence.needsAttention.length,
    },
  };
}
