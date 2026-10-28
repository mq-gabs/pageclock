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
- Database: SQLite file at `apps/api/data/reading-tracker.db` (`DATABASE_URL`, relative to `apps/api`). `db-migrate` applies `apps/api/drizzle/`; the API does not migrate on startup. `db-seed` wipes and reloads the demo library, with dates relative to today in `APP_TIMEZONE`.
- `createApp({ db })` takes its database; API tests use `createTestDb()` (`apps/api/src/test/db.ts`), a migrated in-memory SQLite.
- Page semantics: a session reads pages `startPage+1 … endPage`, so a session continues the previous one when `startPage === prev.endPage` (this is why the fix for a gap after page 174 is "start at page 174").
- Minutes exclude `pausedSeconds`. Stats ignore running timers. Time-overlap warnings check sessions of every book, page checks only the same book.
- Stats work on local date keys (`yyyy-MM-dd`); turn instants into keys with `toDateKey(instant, timeZone)` and do calendar math with the key helpers in `packages/shared/src/stats/dates.ts`.
- Shared test data: `session()` / `draft()` in `packages/shared/src/test-utils.ts`; the hand-checked stats fixture is `packages/shared/src/stats/fixtures.ts`.
- Web data: `apps/web/src/lib/api.ts` (fetch + response validation with shared schemas, throws `ApiRequestError` with `fields`) and `lib/queries.ts` (TanStack Query hooks, keys under `['books', …]`). Forms map `error.fields` back onto inputs with `setError`.
- Figma uses Inter's `normal` line height (set on `body`); sizes outside the token scale (15, 14, 17, 11 px) use arbitrary `text-[15px]` classes. `cn()` knows the custom `text-*` size tokens, so `cn('text-label', 'text-muted')` keeps both.
- Icons are lucide-react (same glyphs as the Figma SVGs) so they take token colors via `currentColor`.
- Dialogs (`components/ui/dialog.tsx`) are full screen below `lg` and a centered 480 px card from `lg`.
- Saving a session (create, edit, and the timer stop in milestone 6) goes through `saveSession()` in `apps/api/src/services/sessions.ts`: one transaction that runs rules 2–4, throws `HttpError` 400 or `WarningsError` (→ 409 `{ warnings }`), writes, then applies rule 6 and bumps the book's `updatedAt`. It returns `{ session, book, offerFinish }`.
- On the web, a 409 becomes `ApiWarningsError` (`lib/api.ts`); the Log session form shows it in `PageCheckBanner` and "Save anyway" resends with `confirmWarnings: true`.
- Form dates and times are in `appTimeZone`, converted with `lib/local-time.ts`; an end time at or before the start time means the session ends the next day.
- `/books/[id]/log` (`?session=<id>` to edit) renders `BookView` behind a `Dialog`: full screen on mobile, 560 px on desktop.
- Timer (rule 5): `apps/api/src/services/timer.ts`; pure helpers (`timerElapsedSeconds`, `timerEndedAt`, `pausedSecondsAfterResume`) in `packages/shared/src/rules/timer.ts`. `GET /api/timer` and the start/pause/resume/`PATCH` routes answer `{ timer: { session, book, previous } | null }`; stop answers like a save (`saveSession()`).
- Stop pauses the timer before opening `/read/finish`, and a paused timer ends at `pausedAt`, so time spent on the Finish screen doesn't count. Discard deletes the running session.
- Web timer state lives under the `['timer']` query key (`useTimer()`); start/pause/update mutations write the response into that cache. Use `mutateAsync` when a mutation clears the timer, because the calling component unmounts before `mutate()` callbacks run.
- Stats: `apps/api/src/services/stats.ts` narrows rows by `started_at` with a day of margin and leaves grouping to the shared functions (rule 8). Summary and streaks responses include `today` (APP_TIMEZONE), so the Stats screen never reads the browser clock. Web stats query keys sit under `['books', 'stats', …]` so book/session/timer mutations refresh them.
- The Stats screen (`components/stats-view.tsx`) has Week/Month/Year only (Figma's "Custom" is post-MVP). The Year chart is pages per month (`byMonth`); the calendar shows the month of the last day shown. Chart bars and axis ticks come from `lib/stats-chart.ts`.
- `apps/api/src/routes/stats.test.ts` holds the hand-computed seed numbers for October 2026 (now = Oct 28, 12:00 Fortaleza).
- Loading, error and empty UI use `LoadingState`, `ErrorState` (with "Try again") and `EmptyState` from `components/states.tsx`. `lib/api.ts` turns a failed `fetch` into `ApiRequestError` `network_error` and a body-less 5xx into a friendly message, so `error.message` is always safe to show.
- Page titles come from `metadata` (`'%s · Reading Tracker'` template). Client-only routes get them from a small server `layout.tsx` next to the page; the Book page's title is the book's, via `generateMetadata` in `books/[id]/layout.tsx`. Don't render `<title>` in client components: Next already emits one.
- Next.js 16: `error.tsx` receives `{ error: unknown, retry }` (not `reset`). Check `apps/web/node_modules/next/dist/docs/` before using a Next API from memory.
- Keyboard: `globals.css` gives every element a `:focus-visible` outline unless it sets its own ring; `AppShell` has a "Skip to content" link to `#content`.
