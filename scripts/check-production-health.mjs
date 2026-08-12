const DEFAULT_BASE_URL = "https://bodyfuel-coaching.com";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

const baseUrl = new URL(process.env.BODYFUEL_BASE_URL ?? DEFAULT_BASE_URL);

const checks = [
  {
    path: "/api/health",
    validate(body) {
      const payload = JSON.parse(body);
      if (payload.ok !== true || payload.service !== "bodyfuel-web") {
        throw new Error("unexpected health response");
      }
    },
  },
  { path: "/", contains: "bodyfuel" },
  { path: "/smart", contains: "bodyfuel smart" },
  { path: "/trial", contains: "7 tage" },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCheck(check) {
  const url = new URL(check.path, baseUrl);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = performance.now();

    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "user-agent": "BodyFuel-Uptime/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await response.text();
      const elapsedMs = Math.round(performance.now() - startedAt);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (check.contains && !body.toLocaleLowerCase("de-DE").includes(check.contains)) {
        throw new Error(`expected page marker "${check.contains}" is missing`);
      }

      check.validate?.(body);
      console.log(`OK ${url.pathname} status=${response.status} duration=${elapsedMs}ms`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${url.pathname} attempt=${attempt}/${MAX_ATTEMPTS}: ${message}`);

      if (attempt < MAX_ATTEMPTS) {
        await delay(attempt * 1_000);
      }
    }
  }

  throw new Error(`${url.pathname} failed after ${MAX_ATTEMPTS} attempts`);
}

for (const check of checks) {
  await runCheck(check);
}
