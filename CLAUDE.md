# Pageclock

Add books, log reading sessions (timer or manual form), and see reading speed and how much and on which days you read. Every user has an account and sees only their own data.

## Scope

- **Books:** add (title, author, total pages), edit, delete; status Want to read, Reading, Finished.
- **Sessions:** start/stop timer or manual form (date, start time, end time, start page, end page); edit, delete.
- **Stats:** pages and minutes by week, month and year; average speed; reading-days calendar; current and longest streak.
- **Accounts:** create account (name, unique nick, password), sign in/out. Settings changes name, nick and password (current password checked first).
- **Backup:** download books and finished sessions as JSON and import it back. Import merges: same title + author (ignoring case) reuses the book, an identical session (same book, times, pages) is skipped, so importing twice adds nothing. Sessions must pass rule 2 against the book they land on; warnings aren't checked. One invalid entry rejects the whole file.
- **Later (not MVP, don't build):** ISBN lookup, tags, re-reads, goals, password reset, real book covers, hosting.

## Metrics

- Pages read = end page − start page + 1. Minutes = end − start, minus paused time.
- Speed = total pages ÷ total minutes × 60 (pages/hour).
- Reading day = a date with at least one session, counted on the session's start date.

## Business rules

Pure functions in `packages/shared` with unit tests; the API is the final authority. Code comments cite these numbers.

1. **Auto start page.** For book B at time t: end page + 1 of B's latest session that started before t (capped at total pages), 1 if none. Used by the timer and the form; the form recomputes it when date or start time changes. The user can override it.
2. **Hard validation (HTTP 400):** ended after started, not in the future, duration ≤ 12 h; start page ≥ 1, end page ≥ start page, end page ≤ total pages.
3. **Page check (warn, don't block).** Compare session S with B's sessions just before (prev) and after (next) by start time, excluding S. Gap: `S.startPage > prev.endPage + 1` (skipped pages). Overlap: `S.startPage ≤ prev.endPage` (pages counted twice). Same checks between `S.endPage` and `next.startPage`. A time overlap with any other session also warns. Each warning carries a suggested fix (e.g. start page 175 after a session ending on 174).
4. **Confirming warnings.** Create/update/stop return 409 `{ warnings }` unless the body has `confirmWarnings: true`.
5. **Timer.** At most one running session (`ended_at` null). Pause sets `paused_at`; resume adds the pause to `paused_seconds`. Stop needs the end page and runs rules 2–4. The timer is loaded from the API, so it survives reloads and device switches.
   5a. **Click times.** Start, pause and resume store the time of the click (`startedAt` / `at` from the browser), not the arrival time. A time after the server's clock is clamped to now; a time before the start, a resume before its pause, or more than 12 h after the start is a 400.
6. **Status.** New books are want_to_read; the first saved session moves them to reading. A session reaching the last page makes the UI offer "Mark as finished" (sets `finished_at`). The user can change status any time.
7. **Progress** = max end page over the book's sessions (0 if none); percent = round(progress ÷ total pages × 100).
8. **Time and days.** Timestamps stored in UTC and grouped by UTC date of `started_at`; weeks start Monday. Grouping happens in TypeScript, not SQL.

API errors use `{ error: { code, message, fields? } }`; warnings use `{ warnings: [{ code, message, suggestion? }] }`. Pages read, duration and speed are computed, never stored.

## UI

- Design: [Figma: Reading Tracker — MVP](https://www.figma.com/design/ECaJc1tChpojQBzLMEonwo) (390 px mobile, 1440 px desktop, plus a Components frame); read it through the Figma MCP server and match spacing and type.
- Below 1024 px: mobile layout with a bottom tab bar (Library, Read, Stats). From 1024 px: 240 px left sidebar with a "Now reading" card.
- Calendar heat levels: heat-0 … heat-4 = 0, 1–44, 45–59, 60–79, 80+ pages.
- BookCover always shows the "missing image" state (2:3 box in heat-0, centered muted book icon, border); sizes sm (48 px, rows) and lg (140 px, Book page), optional `src` for later.
- Routes: `/library`, `/books/[id]`, `/books/[id]/log`, `/read`, `/read/finish`, `/stats`, `/settings`, `/sign-in`, `/create-account`; `/` redirects to `/library`.

## Conventions

- TypeScript strict mode; no `any`. Validate every request body and query with the shared Zod schemas.
- Business rules and stats math live only in `packages/shared` as pure functions; routes call services, services call shared rules.
- Every rule and stats function gets Vitest tests, including edge cases (no sessions, gaps, overlaps, sessions near midnight in America/Fortaleza).
- Every API route gets a Supertest test for success and validation errors.
- Never change the database by hand: edit `schema.ts`, then generate and run a migration.
- UI matches the Figma file; use the design tokens, never raw hex values in components.
- Keep it MVP: don't add features from the "Later" list.

## Commands

| Task               | Command                                           |
| ------------------ | ------------------------------------------------- |
| Install            | `pnpm install`                                    |
| Run both apps      | `pnpm dev`                                        |
| Test everything    | `pnpm test`                                       |
| Lint and typecheck | `pnpm lint`                                       |
| Only what changed  | `pnpm affected`                                   |
| New migration      | `pnpm api:db-generate` then `pnpm api:db-migrate` |
| Seed demo data     | `pnpm api:db-seed`                                |

Every project target also has a root script named `<project>:<target>` (`pnpm web:typecheck`, `pnpm api:test src/routes`); it runs `nx run <project>:<target>`, and extra arguments reach the underlying command. When adding a target to a `project.json`, add its root script too.

## Workspace notes

- One `package.json` at the root holds every dependency; add packages there (`pnpm add <pkg>` at the root). Apps and packages have no `package.json`.
- Each project's Nx name, tags and targets live in its `project.json` (`web`, `api`, `shared`); targets are commands run with `cwd` set to the project folder.
- Module boundaries (`eslint.config.mjs`): `web` and `api` may import only `@reading-tracker/shared`; `shared` imports no project.
- `@reading-tracker/shared` is a TypeScript path alias to `packages/shared/src/index.ts` (in `tsconfig.base.json`, repeated in `apps/web/tsconfig.json` because it sets its own `paths`). No build step: Next, `tsx` and Vitest (`resolve.tsconfigPaths`) follow the alias, and `tsup` bundles it into the API build while keeping the root `dependencies` external.
- Env: optional, gitignored `apps/api/.env.local` (loaded with `--env-file-if-exists` by the api `dev`, `start`, `db-migrate` and `db-seed` targets, not by tests) and `apps/web/.env.local` (Next.js). Real environment variables win.
- Ports: web 3000, api 3333. Next rewrites `/api/*` to `API_URL` (default `http://localhost:3333`).
- Design tokens are CSS variables in `apps/web/src/app/globals.css`, exposed as Tailwind colors (`bg-surface`, `text-muted`, `bg-heat-2`, …), radii (`rounded-card|button|input|cell`) and text sizes (`text-title|section|body|label|meta`). shadcn/ui variables are mapped onto them.
- TypeScript is pinned to 6.0 and ESLint to 9: typescript-eslint and eslint-config-next don't support TS 7 / ESLint 10 yet.
- Database: SQLite file at `apps/api/data/reading-tracker.db` (`DATABASE_URL`, relative to `apps/api`). `db-migrate` applies `apps/api/drizzle/`; the API does not migrate on startup. `db-seed` wipes and reloads the demo library, with dates relative to today in UTC.
- `createApp({ db })` takes its database; API tests use `createTestDb()` (`apps/api/src/test/db.ts`), a migrated in-memory SQLite.
- Page semantics: a session reads pages `startPage … endPage`, both included (pages read = `endPage − startPage + 1`, so a one-page session has `startPage === endPage`). A session continues the previous one when `startPage === prev.endPage + 1`, so after a session ending on page 174 the suggested start is 175. Start pages are ≥ 1.
- Minutes exclude `pausedSeconds`. Stats ignore running timers. Time-overlap warnings check sessions of every book, page checks only the same book.
- Stats work on local date keys (`yyyy-MM-dd`); turn instants into keys with `toDateKey(instant, timeZone)` and do calendar math with the key helpers in `packages/shared/src/stats/dates.ts`.
- Shared test data: `session()` / `draft()` in `packages/shared/src/test-utils.ts`; the hand-checked stats fixture is `packages/shared/src/stats/fixtures.ts`.
- Web data: `apps/web/src/lib/api.ts` (fetch + response validation with shared schemas, throws `ApiRequestError` with `fields`) and `lib/queries.ts` (TanStack Query hooks, keys under `['books', …]`). Forms map `error.fields` back onto inputs with `setError`.
- Theme: tokens are `light-dark(light, dark)` and `color-scheme` picks one; it follows the OS unless `<html data-theme="light|dark">` forces it. The choice is per device in localStorage (`lib/theme.ts` hook, `lib/theme-script.ts` for the `<head>` script that sets it before paint; keep the script in a non-client module so the server layout gets the string). Text on solid fills uses `text-on-accent` (never `text-surface`), backdrops `bg-scrim`, and `ring-offset-*` needs `ring-offset-bg`. Check new UI in both themes.
- Figma uses Inter's `normal` line height (set on `body`); sizes outside the token scale (15, 14, 17, 11 px) use arbitrary `text-[15px]` classes. `cn()` knows the custom `text-*` size tokens, so `cn('text-label', 'text-muted')` keeps both.
- Logo: `components/logo.tsx` (`PageclockWordmark`, `PageclockSymbol`) draws the brand mark with token colors; the tab and home-screen icons are `favicon.ico`, `icon.svg` and `apple-icon.png` in `apps/web/src/app/`. Source files and the brand guide are in `assets/brand/`.
- Icons are lucide-react (same glyphs as the Figma SVGs) so they take token colors via `currentColor`.
- Dialogs (`components/ui/dialog.tsx`) are full screen below `lg` and a centered 480 px card from `lg`.
- Saving a session (create, edit, and the timer stop in milestone 6) goes through `saveSession()` in `apps/api/src/services/sessions.ts`: one transaction that runs rules 2–4, throws `HttpError` 400 or `WarningsError` (→ 409 `{ warnings }`), writes, then applies rule 6 and bumps the book's `updatedAt`. It returns `{ session, book, offerFinish }`.
- On the web, a 409 becomes `ApiWarningsError` (`lib/api.ts`); the Log session form shows it in `PageCheckBanner` and "Save anyway" resends with `confirmWarnings: true`.
- Everything is in UTC (`APP_TIME_ZONE` in shared; no setting). `createApp({ db, timeZone })` only takes another zone so API tests keep their America/Fortaleza fixtures. Form dates and times are in `appTimeZone` (= UTC), converted with `lib/local-time.ts`; an end time at or before the start time means the session ends the next day.
- Log session and Finish session are local dialogs with their own URLs: `/books/[id]/log` (`?session=<id>` to edit) and `/read/finish` re-export the parent page, and `BookView` / `TimerView` open the dialog when `usePathname()` matches. Open them with `useLocalDialog().open(href)` (a `history.pushState`, no server round trip) or a `LocalLink`; `close()` goes back. Dialogs are full screen on mobile, 560 / 480 px on desktop.
- Timer (rule 5): `apps/api/src/services/timer.ts`; pure helpers (`timerElapsedSeconds`, `timerEndedAt`, `pausedSecondsAfterResume`, rule 5a's `acceptTimerStart` / `acceptTimerAction`) in `packages/shared/src/rules/timer.ts`. Start, pause, resume and `PATCH` bodies carry an `opId` and the browser-generated `sessionId` (the row's id); the session's `last_op_id` makes a retried action a 200 no-op, a retried Start of the running session returns it, and an action for any session but the running one is 404 `no_timer`. `applyTimerOp()` (`rules/timer-ops.ts`) applies a waiting action to a timer for display. API tests build start bodies with `startTimerBody()` (`apps/api/src/test/timer.ts`). `GET /api/timer` and the start/pause/resume/`PATCH` routes answer `{ timer: { session, book, previous } | null }`; stop answers like a save (`saveSession()`).
- Stop pauses the timer before opening `/read/finish`, and a paused timer ends at `pausedAt`, so time spent on the Finish screen doesn't count. Discard deletes the running session.
- Web timer: actions never wait for the network. `useTimerActions()` (`start`, `pause`, `resume`, `setStartPage`, `discard`) adds them to the timer queue (`lib/timer-queue.ts`), stamped with `serverNow()` (`lib/server-clock.ts`, estimated from the `Date` header of every API response). `useTimer()` is the server timer under `['timer']` with the waiting actions applied (`applyTimerOps`); its `session.startPage` is null until the API has a Start without a chosen page (shown as "…").
- Timer queue: per-user list in localStorage (`pageclock.timer-queue.<userId>`, memory fallback), sent one at a time in order under `navigator.locks`; success drops the action and writes the answer into `['timer']`; network errors, 5xx, 429, 408 and a 10 s timeout retry after 1, 2, 4, 5… s (30 s from the 10th failure); other 4xx drop the action and its session's later ones, refetch and toast; 401 pauses until the user signs in again. A Discard of a Start not yet sent stays local; a retried Discard's 404 counts as done. Sign-out clears the list. `TimerQueueSync` (in `AppShell`) gives the queue the user and the cache. Saving the Finish form waits for `timerQueue.flush()`, then calls `POST /api/timer/stop`.
- `ConnectionBanner` (`components/connection-banner.tsx`) is a generic warning stripe at the top of `AppShell`; `TimerConnectionBanner` shows it after 3 failed sends in a row (`failureBannerThreshold`), with "Retry now". `/dev` has a "Simulate offline" switch for the queue.
- Stats: `apps/api/src/services/stats.ts` narrows rows by `started_at` with a day of margin and leaves grouping to the shared functions (rule 8). Summary and streaks responses include `today` (UTC), so the Stats screen never reads the browser clock. Web stats query keys sit under `['books', 'stats', …]` so book/session/timer mutations refresh them.
- The Stats screen (`components/stats-view.tsx`) has Week/Month/Year only (Figma's "Custom" is post-MVP). The Year chart is pages per month (`byMonth`); the calendar shows the month of the last day shown. Chart bars and axis ticks come from `lib/stats-chart.ts`.
- `apps/api/src/routes/stats.test.ts` holds the hand-computed seed numbers for October 2026 (now = Oct 28, 12:00 Fortaleza).
- Loading UI is skeletons (`components/skeletons.tsx`), used both in each route's `loading.tsx` and while a screen's queries are pending; error and empty UI use `ErrorState` (with "Try again") and `EmptyState` from `components/states.tsx`. `lib/api.ts` turns a failed `fetch` into `ApiRequestError` `network_error` and a body-less 5xx into a friendly message, so `error.message` is always safe to show.
- Page titles come from `metadata` (`'%s · Pageclock'` template); client-only routes get them from a small server `layout.tsx`. `books/[id]/layout.tsx` must stay static (no API calls): Next prefetches it down to `loading.tsx` before a click. `BookView` renders a React `<title>` with the book's title (hoisted ahead of the layout's "Book" fallback); don't set `document.title`, Next overwrites it.
- Next.js 16: `error.tsx` receives `{ error: unknown, retry }` (not `reset`). Check `node_modules/next/dist/docs/` before using a Next API from memory.
- Keyboard: `globals.css` gives every element a `:focus-visible` outline unless it sets its own ring; `AppShell` has a "Skip to content" link to `#content`.
- Auth: bearer tokens. `requireAuth(db)` (`apps/api/src/middleware/auth.ts`) guards every router but health and `/api/auth`; routes read the user with `userIdOf(req)` and pass `userId` to every service, which filters by it (another user's row is a 404). `books` and `reading_sessions` both carry `user_id`; set it on every insert. Tokens are stored as SHA-256 in `auth_tokens` (30 days); passwords use scrypt (`services/password.ts`). The logger redacts the `Authorization` header. Schemas: `packages/shared/src/schemas/auth.ts` (nicks are trimmed and lowercased).
- API tests: `seed()` returns the demo `userId`; use `authedAgent(app, db, userId)` and `createTestUser(db)` from `apps/api/src/test/auth.ts`. Demo account: `demo` / `pageclock`.
- Web auth: the token is in localStorage (`lib/auth-token.ts`); `lib/api.ts` sends it and clears it on a 401. `AppShell` gates routes: public ones are listed in `lib/auth-routes.ts` (`/sign-in`, `/create-account`, rendered without nav); signed out, others redirect to `/sign-in?next=…` (checked with `safeNext`). Sign in/up/out clear the query cache; the user is `useMe()` under `['me']`. Forms map API errors with `setApiErrors()` (`lib/form-errors.ts`).
- Navigation feedback: use `AppLink` (`components/app-link.tsx`) instead of `next/link`, and `useAppRouter()` (`lib/navigation-progress.ts`) instead of `useRouter().push/replace`; both drive the top `NavigationProgress` bar while a route loads. Query-string-only changes (Library filters) use `history.replaceState`, which needs no server round trip.
- Backup: `GET /api/backup` exports `backupSchema` (`packages/shared/src/schemas/backup.ts`, `format: 'pageclock-backup'`, `version: 1`; running timers left out); `POST /api/backup` merges a file via the pure `planBackupImport()` (`rules/import-backup.ts`) in one transaction (`services/backup.ts`). Its errors are keyed by full path (`sessions.3.endPage`, `parseBodyByPath`), and `/api/backup` alone parses JSON up to 20 MB. Web: the Backup card in `settings-view.tsx`, labels in `lib/backup.ts`.
