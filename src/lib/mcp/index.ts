import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import nutritionToday from "./tools/nutrition-today";
import recentWeight from "./tools/recent-weight";
import logWeight from "./tools/log-weight";
import coachBusinessSummary from "./tools/coach-business-summary";
import coachOpenTasks from "./tools/coach-open-tasks";
import coachUpdateTrainingPlanEndDate from "./tools/coach-update-training-plan-end-date";
import coachReactivateTrainingPlan from "./tools/coach-reactivate-training-plan";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bodyfuel-mcp",
  title: "BODYFUEL Coaching",
  version: "0.2.0",
  instructions:
    "Tools for the signed-in BODYFUEL user. Customers can read their own profile, nutrition, and weight data. Signed-in coaches can read BodyFuel coach insights and safely manage personal training-plan end dates and archived-plan reactivation. All access is authenticated and enforced by Supabase RLS plus role checks.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    nutritionToday,
    recentWeight,
    logWeight,
    coachBusinessSummary,
    coachOpenTasks,
    coachUpdateTrainingPlanEndDate,
    coachReactivateTrainingPlan,
  ],
});
