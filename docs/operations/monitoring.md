# BodyFuel technical monitoring

## Active foundation

- `Quality Gate` runs for pull requests and every push to `main`.
- Pull requests lint only changed source files while the repository-wide lint backlog is reduced.
- The required gate installs from `package-lock.json`, checks build safeguards, type-checks, runs the full test suite and creates the production bundle.
- `Production Uptime` checks production every 15 minutes and can also be started manually.
- The uptime check verifies `/api/health`, `/`, `/smart` and `/trial` without using a customer account or customer data.

GitHub marks failed runs in Actions and sends notifications according to the repository owner's GitHub notification settings. The uptime workflow is intentionally read-only and never performs an automatic rollback, deployment or data change.

## Health endpoint

`GET /api/health` proves that the deployed web server can execute a server route. It returns no configuration, version, database details or customer data and must not be treated as a deep Supabase health check.

## Incident response

1. Confirm which public check failed and whether retries also failed.
2. Compare the latest deployment with the latest successful quality run.
3. Check deployment and Supabase logs for the same time window.
4. Reproduce the affected route before changing code.
5. Roll back only when a specific deployment is the likely cause and a known-good deployment exists.
6. Verify `/api/health` and all public checks after recovery.

## Known observation gaps

- Client- and server-side exception tracking is not connected yet.
- Supabase backup retention and a test restore are not verified by these workflows.
- Authenticated customer, coach and team journeys are not used for synthetic monitoring.
- Real-user Core Web Vitals and performance trends are not collected yet.
- The repository-wide lint command and the legacy TanStack server-validator guard already fail on the current baseline; changed-file linting prevents the new work from adding more lint errors.

Closing these gaps requires selecting the alert destination and connecting the relevant production services. Do not claim full 24/7 application coverage until those signals are active and a test alert has been received.
