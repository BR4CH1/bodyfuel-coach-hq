const RESEND_SEND_URL = "https://api.resend.com/emails";

type SendResendEmailInput = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  category: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function safeIdempotencyKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `coach_followup_${toHex(digest)}`;
}

export async function sendResendEmail(input: SendResendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "E-Mail-Versand ist noch nicht konfiguriert (RESEND_API_KEY fehlt auf dem Server).",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(RESEND_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": await safeIdempotencyKey(input.idempotencyKey),
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        reply_to: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: [{ name: "category", value: input.category }],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as ResendResponse | null;
    if (!response.ok || !payload?.id) {
      const reason = payload?.message ?? payload?.name ?? `HTTP ${response.status}`;
      throw new Error(`Resend hat den Versand abgelehnt: ${reason}`);
    }

    return { id: payload.id };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Der Maildienst hat nicht rechtzeitig geantwortet.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
