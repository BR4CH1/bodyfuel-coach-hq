# Training weekday/calendar alignment fix

## Incident

Smart training plans generated with `startMode="today"` could start on any weekday, while `buildWeekPlan` previously paired sequential dates with a hard-coded Monday→Sunday weekday order. A plan generated on Tuesday therefore stored Tuesday as the internal Monday, shifting every configured training/rest day by one calendar day.

## Fix

- derive each `PlannedDay.weekday` from its actual `day_date`
- keep the seven-day plan window anchored to the requested start date
- resolve day-type schedules from the week containing the requested date when dated training days are available
- retain first-week fallback for legacy/imported plans without `day_date`
- regression-test a Tuesday start with Mon/Tue/Wed/Fri/Sat training weekdays

## Production repair 2026-08-14

The affected active plan was repaired only for its current week by moving existing day rows to the intended dates. Exercise/day identities and training logs were left intact. A one-day `training` override was set for 2026-08-14 so nutrition day type is correct before the permanent code fix is deployed.
