# BodyFuel Agent Operating System

This repository is operated as part of the BodyFuel project. ChatGPT acts as the human-facing orchestrator; specialist chats and coding agents work within defined domains.

## Core principle

Route work to the narrowest competent domain, preserve context, and avoid cross-domain changes unless they are necessary to complete the task.

## Specialist domains

1. **HQ / Orchestrator**
   - Product direction, prioritization, cross-domain decisions, handoffs.
   - Resolves conflicts between specialist domains.

2. **Technology & App**
   - Application code, bugs, architecture, GitHub, Supabase, Lovable integration, PWA, CI, performance, security and developer tooling.
   - Owns technical implementation work in this repository.

3. **Social Media & Marketing**
   - Instagram, LinkedIn, Reels, captions, content calendars, campaigns, positioning and community growth.
   - Does not make product-code changes unless explicitly handed to Technology & App.

4. **Coaching & Clients**
   - Coaching workflows, check-ins, nutrition/training experience, client communication logic and coach operations.
   - Product changes that implement these workflows are handed to Technology & App.

5. **Sales & Partnerships**
   - Studios, clubs, corporate partners, pitches, offers, outreach and partnership pipelines.

6. **Brand & Creative**
   - BodyFuel visual identity, Fuely, creative concepts, campaign assets and UI-brand consistency.

7. **Admin & Finance**
   - Pricing logic, invoices, contracts, administrative workflows and commercial rules.

8. **Insights & Growth**
   - KPIs, funnels, experiments, retention, activation, cohort analysis and product-growth hypotheses.

## Technical agent workflow

For every coding task:

1. Inspect relevant code and existing tests before editing.
2. State the concrete failure, requirement or acceptance criteria.
3. Make the smallest coherent change that solves the problem.
4. Add or update regression coverage when behavior changes.
5. Run the most relevant checks. Prefer:
   - `npm run typecheck`
   - `npm test`
   - targeted ESLint for changed hand-written files
   - `npm run verify` for broader changes
   - `npm run verify:build` before release-sensitive changes
6. Report changed files, validation performed, remaining risks and any follow-up work.

## Safety and change-control rules

- Never commit secrets, tokens, passwords or production credentials.
- Do not expose `.env` contents in chat, issues, logs or PR descriptions.
- Do not perform destructive production database changes without an explicit migration plan and rollback strategy.
- Prefer additive, reversible migrations.
- Do not silently broaden permissions or bypass authorization/RLS checks.
- Do not merge or deploy merely because tests pass; merge/deploy requires an explicit user instruction when the change is production-affecting.
- Preserve existing public behavior unless the task explicitly changes it.

## Handoff protocol

When a task crosses domains, identify the primary owner and list the required secondary handoff. Examples:

- New nutrition check-in UX: Coaching & Clients defines behavior; Technology & App implements it; Brand & Creative reviews presentation.
- Instagram campaign for a new Smart feature: Social Media & Marketing owns campaign; Technology & App confirms factual feature behavior; Brand & Creative owns visuals.
- Partner dashboard feature: Sales & Partnerships defines commercial need; Technology & App implements; Insights & Growth defines success metrics.

## Definition of done for code

A technical task is done only when the implementation is coherent, relevant checks pass, user-facing behavior is verified where practical, and unresolved risks are explicitly documented.
