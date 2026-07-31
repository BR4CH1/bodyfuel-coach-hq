import { afterEach, describe, expect, it, vi } from "vitest";

import { sendResendEmail } from "@/lib/email/resend.server";

const message = {
  from: "Manuel | BodyFuel <manuel@bodyfuel-coaching.com>",
  to: "kunde@example.com",
  replyTo: "manuel@bodyfuel-coaching.com",
  subject: "Kurzer Check-in",
  html: "<p>Wie läuft es?</p>",
  text: "Wie läuft es?",
  idempotencyKey: "coach-followup:coach-1:signal-1",
  category: "coach-followup",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Resend mail provider", () => {
  it("fails closed when the server key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(sendResendEmail(message)).rejects.toThrow("RESEND_API_KEY fehlt");
  });

  it("sends only server-side data with a stable idempotency key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "resend-message-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendResendEmail(message)).resolves.toEqual({ id: "resend-message-1" });

    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body));

    expect(url).toBe("https://api.resend.com/emails");
    expect(headers.get("Authorization")).toBe("Bearer re_test");
    expect(headers.get("Idempotency-Key")).toMatch(/^coach_followup_[a-f0-9]{64}$/);
    expect(body).toMatchObject({
      from: message.from,
      to: [message.to],
      reply_to: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: [{ name: "category", value: "coach-followup" }],
    });
  });

  it("surfaces provider errors without pretending delivery succeeded", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Domain is not verified" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    await expect(sendResendEmail(message)).rejects.toThrow(
      "Resend hat den Versand abgelehnt: Domain is not verified",
    );
  });
});
