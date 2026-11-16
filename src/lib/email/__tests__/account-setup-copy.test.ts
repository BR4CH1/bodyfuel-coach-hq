import { describe, it, expect } from "vitest";
import { accountSetupCopy, template } from "@/lib/email-templates/account-setup";

describe("account setup email copy", () => {
  it("reset mail is not a Smart welcome", () => {
    expect(accountSetupCopy("reset").subject).not.toMatch(/Smart/);
    expect((template.subject as any)({ kind: "reset" })).toMatch(/Passwort/);
  });
  it("coaching invite mentions Coaching, not Smart", () => {
    expect(accountSetupCopy("coaching").body).toMatch(/Coaching/);
    expect(accountSetupCopy("coaching").body).not.toMatch(/Smart/);
  });
  it("only smart kind mentions Smart", () => {
    expect(accountSetupCopy("smart").subject).toMatch(/Smart/);
    expect(accountSetupCopy(undefined).subject).not.toMatch(/Smart/);
  });
});
