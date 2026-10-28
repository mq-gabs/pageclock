# Reading Tracker

`SPEC.md` is the source of truth. Build in the order of its Build plan.

## Conventions

- Work one Build plan milestone at a time; finish its checks before starting the next.
- TypeScript strict mode; no `any`. Validate every request body and query with the shared Zod schemas.
- Business rules and stats math live only in `packages/shared` as pure functions; routes call services, services call shared rules.
- Every rule and stats function gets Vitest tests, including edge cases (no sessions, gaps, overlaps, sessions near midnight in America/Fortaleza).
- Every API route gets a Supertest test for success and validation errors.
- Never change the database by hand: edit `schema.ts`, then generate and run a migration.
- UI matches the Figma file; use the design tokens, never raw hex values in components.
- Keep it MVP: don't add features from the "Later" list.

## Commands

| Task               | Command                                                         |
| ------------------ | --------------------------------------------------------------- |
| Install            | `pnpm install`                                                  |
| Run both apps      | `pnpm nx run-many -t dev -p web api`                            |
| Test everything    | `pnpm nx run-many -t test`                                      |
| Lint and typecheck | `pnpm nx run-many -t lint typecheck`                            |
| Only what changed  | `pnpm nx affected -t lint test typecheck`                       |
| New migration      | `pnpm nx run api:db-generate` then `pnpm nx run api:db-migrate` |
| Seed demo data     | `pnpm nx run api:db-seed`                                       |

## Workspace notes

- Nx targets come from each project's `package.json` scripts; project names and tags live in its `nx` field (`web`, `api`, `shared`).
- Module boundaries (`eslint.config.mjs`): `web` and `api` may import only `@reading-tracker/shared`; `shared` imports no project.
- `@reading-tracker/shared` ships TypeScript source (no build step): Next transpiles it (`transpilePackages`), `tsx` runs it in API dev, and `tsup` bundles it into the API build.
- Ports: web 3000, api 3333. Next rewrites `/api/*` to `API_URL` (default `http://localhost:3333`).
- Design tokens are CSS variables in `apps/web/src/app/globals.css`, exposed as Tailwind colors (`bg-surface`, `text-muted`, `bg-heat-2`, …), radii (`rounded-card|button|input|cell`) and text sizes (`text-title|section|body|label|meta`). shadcn/ui variables are mapped onto them.
- TypeScript is pinned to 6.0 and ESLint to 9: typescript-eslint and eslint-config-next don't support TS 7 / ESLint 10 yet.
