# Architecture rules

- Food catalogue corrections use explicitly reviewed source-record mappings with before-value snapshots; energy plausibility flags never overwrite source kcal, and historical logs remain untouched.
- Reusing a linked food suggestion and saving a food draft must revalidate its current catalogue values; source-review exclusions must not be bypassed by historical snapshots.

- Nutrition archive reactivation uses the existing transitionPlanStatus function and a pure scheduling helper; keep meals, ingredient amounts and targets untouched to preserve the original plan.
- Public nutrition guides use a browser-safe content catalogue shared by article routes and the existing sitemap; this keeps published article URLs and search metadata consistent without accessing customer data.
- Landing testimonials read only the consented, approved, non-hidden public review view; never substitute invented reviews or expose the private base table.
- Account setup emails must check suppression and attach a stored, unused unsubscribe token before enqueueing; the email service rejects transactional payloads without it.
- Challenge ranking isolation belongs in the authenticated get_ranking database function using existing user_groups; this keeps participant filtering enforced server-side without duplicating point storage.
- Coach challenge progress derives date-windowed task scores from existing daily_checks through the coach-authorized application list; no parallel point ledger is maintained.