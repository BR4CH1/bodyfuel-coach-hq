# BodyFuel – Phase 1 Technical Audit

## Scope
Initial repository hygiene and architecture review based on the uploaded project snapshot.

## Confirmed inventory
- 598 files below `src/`
- 266 Supabase migration files
- 3 automated test files
- 387 usages of deprecated/legacy `.inputValidator(...)`
- React 19, TanStack Start/Router, Supabase, Vite, TypeScript

## Immediate changes applied
- Added `.env` and `.env.*` to `.gitignore`
- Preserved `.env.example` as a safe template
- Removed environment files from this distributable working copy

## Highest-risk technical areas
1. Very large route and feature files (several above 40–80 KB) increase regression risk.
2. Generated files (`routeTree.gen.ts`, Supabase types) are large but should not be manually refactored.
3. 387 legacy `inputValidator` calls require a controlled migration, not a bulk blind replacement.
4. Test coverage is insufficient for nutrition planning, coaching, teams, payments and authorization.
5. 266 sequential database migrations warrant a schema-baseline and policy audit before major new modules.

## Largest handwritten files observed
- `src/routes/coach.teams.$orgId.tsx`
- `src/lib/nutrition-plan-ai.functions.ts`
- `src/components/bodyfuel/PlanBuilderPage.tsx`
- `src/routes/index.tsx`
- `src/routes/coach.index.tsx`
- `src/components/bodyfuel/NutritionTracker.tsx`

## Recommended execution order
1. Establish a clean build and type-check baseline.
2. Add feature-level smoke tests around auth, roles and nutrition plan loading.
3. Extract large route files into feature modules without behavior changes.
4. Introduce a module boundary for Virtual Classes.
5. Add database migrations and RLS policies for Virtual Classes only after the UI/domain model is fixed.
6. Migrate legacy validators in small batches with tests.

## Virtual Classes target boundary
Suggested new feature namespace:

```
src/features/virtual-classes/
  components/
  routes/
  schemas/
  server/
  types/
```

Keep video metadata, course sessions, access permissions and completion tracking separate from existing nutrition/training plan logic.
