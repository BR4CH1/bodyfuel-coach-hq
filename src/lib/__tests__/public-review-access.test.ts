import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0001_restore_consented_public_reviews.sql", "utf8");
describe("public review privacy", () => {
  it("requires consent to publication with a name", () => {
    expect(sql).toMatch(/USING\s*\([^;]*publish_with_name\s*=\s*true/);
  });
  it("requires approval", () => {
    expect(sql).toMatch(/USING\s*\([^;]*approved_for_public\s*=\s*true/);
  });
  it("excludes hidden reviews", () => {
    expect(sql).toMatch(/USING\s*\([^;]*hidden\s*=\s*false/);
  });
  it("never grants anonymous access to private review columns", () => {
    const grant = sql.match(/GRANT SELECT\s*\(([^)]+)\) ON public\.app_reviews TO anon/);
    expect(grant?.[1].split(",").map(s => s.trim())).toEqual(["id", "rating", "comment", "first_name", "created_at", "publish_with_name", "approved_for_public", "hidden"]);
    expect(sql).not.toMatch(/GRANT SELECT ON public\.app_reviews TO anon/);
  });
});