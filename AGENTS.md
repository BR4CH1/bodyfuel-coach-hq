# Architecture rules

- Nutrition archive reactivation uses the existing transitionPlanStatus function and a pure scheduling helper; keep meals, ingredient amounts and targets untouched to preserve the original plan.
- Public nutrition guides use a browser-safe content catalogue shared by article routes and the existing sitemap; this keeps published article URLs and search metadata consistent without accessing customer data.
- Landing testimonials read only the consented, approved, non-hidden public review view; never substitute invented reviews or expose the private base table.
- Account setup emails must check suppression and attach a stored, unused unsubscribe token before enqueueing; the email service rejects transactional payloads without it.