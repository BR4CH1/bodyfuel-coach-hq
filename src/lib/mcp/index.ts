import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import nutritionToday from "./tools/nutrition-today";
import recentWeight from "./tools/recent-weight";
import logWeight from "./tools/log-weight";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bodyfuel-mcp",
  title: "BODYFUEL Coaching",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in BODYFUEL user. Read the user's profile, today's nutrition, and recent weight measurements. Log a new body-weight measurement. All data access is scoped to the authenticated user via Supabase RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, nutritionToday, recentWeight, logWeight],
});
