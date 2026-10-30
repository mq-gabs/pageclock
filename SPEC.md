# Pageclock — MVP Spec

Oct 28, 2026 · @gabs

The MVP lets you add books, log reading sessions (start time, end time, pages), and see your reading speed and how much and on which days you read.

This spec is the source of truth for implementation with Claude Code: build in the order of the Build plan, follow Conventions, and match the Figma design.

## MVP scope

- **Books:** add (title, author, total pages), edit, delete, status: Want to read, Reading, Finished.
- **Reading sessions:** log with a start/stop timer or a manual form; edit and delete.
  - Manual form: date, start time, end time, start page, end page.
  - Auto start page: the start page is prefilled with the page after the end page of the book's latest session (page 1 for a new book), in both the timer and the form. The user can still change it.
  - Page check: a new or edited log is compared with the book's sessions just before and after it in time. If the pages don't line up, show a warning (gap = skipped pages, overlap = pages counted twice) and let the user fix it or save anyway.
  - Hard rules: end time after start time, start page at least 1, end page not before start page, end page not above the book's total pages.
- **Stats:** pages and minutes by week, month and year; average speed; calendar of reading days; current streak.
- **Accounts:** create an account (name, unique nick, password), sign in and out; every screen and API route except sign-in and create-account needs a signed-in user, and each user sees only their own books, sessions, timer and stats. Settings changes the name, the nick (must be unique) and the password (the current password is checked first).

Later, not in MVP: ISBN lookup, tags, re-reads, goals, import/export, password reset, real book covers, hosting.

## Metrics

- Pages read = end page − start page + 1 (both pages count: a session from page 13 to page 20 reads 8 pages)
- Minutes = end time − start time
- Speed = total pages ÷ total minutes × 60 (pages/hour)
- Reading day = a date (your timezone) with at least one session, counted on the session's start date

## Business rules

These rules live in `packages/shared` as pure functions with unit tests, and the API is the final authority.

1. **Auto start page.** When the timer starts or the manual form opens for book B at time t, start page = end page + 1 of B's latest session that started before t (capped at total_pages); 1 if none. The form recomputes it when date or start time changes. The user can override it.
2. **Hard validation (block save, HTTP 400):**
   - ended_at after started_at, not in the future, duration ≤ 12 h
   - start_page ≥ 1, end_page ≥ start_page, end_page ≤ book.total_pages
3. **Page check (warn, don't block).** For a new or edited session S of book B, compare with B's sessions immediately before (prev) and after (next) S by started_at, excluding S itself:
   - S continues prev when S.start_page = prev.end_page + 1
   - Gap: S.start_page > prev.end_page + 1 → pages prev.end_page+1 … S.start_page−1 are skipped
   - Overlap: S.start_page ≤ prev.end_page → pages S.start_page … prev.end_page counted twice
   - Same two checks between S.end_page and next.start_page (next continues S when next.start_page = S.end_page + 1)
   - Time overlap with any other session → warning
   - Each warning carries a suggested fix (e.g. start page 175 after a session that ended on 174)
4. **Confirming warnings.** Create/update returns HTTP 409 with the warnings unless the body has `confirmWarnings: true`. The UI shows the warning banner; "Save anyway" resends with the flag.
5. **Timer.** At most one running session at a time (ended_at is null). Pause stores paused_at; resume adds the paused time to paused_seconds. Stop requires end_page and runs rules 2–4. The running timer is loaded from the API on page load, so it survives reloads and device switches.
6. **Status.** New books start as want_to_read. Saving the first session moves want_to_read → reading. When a session reaches the last page, the UI offers "Mark as finished" (sets finished_at). The user can change status any time.
7. **Progress** = max end_page over the book's sessions (0 if none); percent = round(progress ÷ total_pages × 100).
8. **Time and days.** Store timestamps in UTC. Group by the APP_TIMEZONE setting (default America/Fortaleza): a session belongs to the local date of started_at; weeks start Monday. Do the grouping in TypeScript, not SQL.

## Data model

Four tables in SQLite via Drizzle (`apps/api/src/db/schema.ts`). IDs are text UUIDs; timestamps use `integer({ mode: 'timestamp_ms' })` in UTC.

**users**

| Column                 | Type      | Rules                                                            |
| ---------------------- | --------- | ---------------------------------------------------------------- |
| id                     | text      | PK                                                               |
| name                   | text      | not null, 1–100 chars                                            |
| nick                   | text      | not null, unique, 3–30 chars, lowercase letters, digits, `.` `_` |
| password_hash          | text      | scrypt with a random salt                                        |
| created_at, updated_at | timestamp | default now                                                      |

**auth_tokens**: token_hash (PK, SHA-256 of the bearer token), user_id (FK → users, cascade), expires_at (30 days after sign-in), created_at.

**books** (and **reading_sessions**) have a `user_id` FK → users, cascade.

| Column                 | Type      | Rules                                                 |
| ---------------------- | --------- | ----------------------------------------------------- |
| id                     | text      | PK                                                    |
| title                  | text      | not null, 1–300 chars                                 |
| author                 | text      | not null, 1–200 chars                                 |
| total_pages            | integer   | not null, 1–10000                                     |
| status                 | text enum | want_to_read, reading, finished; default want_to_read |
| finished_at            | timestamp | nullable                                              |
| created_at, updated_at | timestamp | default now                                           |

**reading_sessions**

| Column                 | Type      | Rules                     |
| ---------------------- | --------- | ------------------------- |
| id                     | text      | PK                        |
| book_id                | text      | FK → books, cascade       |
| started_at             | timestamp | not null                  |
| ended_at               | timestamp | null while the timer runs |
| paused_at              | timestamp | set while paused          |
| paused_seconds         | integer   | default 0                 |
| start_page             | integer   | not null, ≥ 1             |
| end_page               | integer   | null while running        |
| source                 | text enum | timer, manual             |
| created_at, updated_at | timestamp | default now               |

Indexes: `reading_sessions(started_at)` and `reading_sessions(book_id, started_at)`. Only one running timer is allowed; the timer service checks this inside a transaction. Pages read, duration and speed are computed, never stored.

## API

Express serves JSON under `/api`; Next.js rewrites `/api/*` to it, so the browser sees one origin and no CORS setup is needed. Every route except `/api/health` and `/api/auth/sign-up|sign-in` needs `Authorization: Bearer <token>` and answers 401 without a valid one; another user's book or session is a 404. Request and response bodies are validated with the Zod schemas from `packages/shared`.

| Method | Path                                              | Notes                                                           |
| ------ | ------------------------------------------------- | --------------------------------------------------------------- |
| POST   | /api/auth/sign-up                                 | { name, nick, password } → 201 { token, user }; 409 nick_taken  |
| POST   | /api/auth/sign-in                                 | { nick, password } → { token, user }; 401 if wrong              |
| POST   | /api/auth/sign-out                                | Ends the token that sent it                                     |
| GET    | /api/me                                           | { user }                                                        |
| PATCH  | /api/me                                           | { name?, nick? }; 409 nick_taken                                |
| PUT    | /api/me/password                                  | { currentPassword, newPassword }; signs out other devices       |
| GET    | /api/books?status=&q=                             | List with progress and percent                                  |
| POST   | /api/books                                        | title, author, totalPages                                       |
| GET    | /api/books/:id                                    | Book, progress, per-book stats                                  |
| PATCH  | /api/books/:id                                    | Any book field, including status                                |
| DELETE | /api/books/:id                                    | Cascades to sessions                                            |
| GET    | /api/books/:id/sessions                           | Newest first                                                    |
| GET    | /api/books/:id/suggested-start-page?at=           | Rule 1                                                          |
| POST   | /api/reading-sessions/check                       | Returns { errors, warnings, suggestedStartPage } without saving |
| POST   | /api/reading-sessions                             | Manual log; 409 + warnings unless confirmWarnings               |
| PATCH  | /api/reading-sessions/:id                         | Same validation as create                                       |
| DELETE | /api/reading-sessions/:id                         |                                                                 |
| GET    | /api/timer                                        | The running session or null                                     |
| PATCH  | /api/timer                                        | { startPage }; change the running timer's start page            |
| POST   | /api/timer/start                                  | { bookId, startPage? }; 409 if one is running                   |
| POST   | /api/timer/pause · /resume                        |                                                                 |
| POST   | /api/timer/stop                                   | { endPage, confirmWarnings? }; same validation as create        |
| GET    | /api/stats/summary?period=week\|month\|year&date= | Totals, avg speed, reading days, change vs previous period      |
| GET    | /api/stats/daily?from=&to=                        | Pages and minutes per local day (chart + calendar)              |
| GET    | /api/stats/streaks                                | Current and longest streak                                      |

Errors use one shape: `{ error: { code, message, fields? } }`; warnings use `{ warnings: [{ code, message, suggestion? }] }`.

## UI

The design is in [Figma: Reading Tracker — MVP](https://www.figma.com/design/ECaJc1tChpojQBzLMEonwo): six screens at 390 px (mobile) and 1440 px (desktop), plus a Components frame. Claude Code can read it through the Figma MCP server; match spacing and type from there.

**Breakpoints:** below 1024 px use the mobile layout with a bottom tab bar (Library, Read, Stats); from 1024 px use a 240 px left sidebar with a "Now reading" card. Finish session and Log session are full screens on mobile and centered dialogs (480 / 560 px) on desktop.

**Design tokens** (Tailwind theme colors, CSS variables; font Inter):

| Token           | Hex                                         | Use                                        |
| --------------- | ------------------------------------------- | ------------------------------------------ |
| bg              | #FAF8F5                                     | Page background                            |
| surface         | #FFFFFF                                     | Cards, inputs, bars                        |
| border          | #E7E2DA                                     | Borders, progress track                    |
| ink             | #1F1B16                                     | Main text                                  |
| muted           | #6F675E                                     | Secondary text, inactive icons             |
| accent          | #2E6B57                                     | Primary buttons, active nav, progress      |
| accent-tint     | #E2EFE8                                     | Active chip, active nav background         |
| warning         | #9A5B0F                                     | Page-check text and border                 |
| warning-tint    | #FCF1DE                                     | Page-check banner                          |
| heat-0 … heat-4 | #EFEBE5, #CFE5DA, #8CC2A8, #4E9A7A, #2E6B57 | Calendar: 0, 1–44, 45–59, 60–79, 80+ pages |

Radii: 14 cards, 12 buttons and banners, 10 inputs, 6 calendar cells. Text sizes: 32/28 page titles, 22–24 section titles, 16 body, 13 labels, 12 meta.

**Components** (shadcn/ui where one exists): Button (primary, secondary), Chip (default, active), BookCover, BookRow, StatCard, Field (label, input, helper), PageCheckBanner, PeriodSwitcher, PagesBarChart, ReadingCalendar, BottomNav, Sidebar.

**BookCover:** books have no images in the MVP, so BookCover always renders the "missing image" state: a 2:3 box in heat-0 with a centered book icon in muted, and a border. It takes a size (sm 48 px wide in rows, lg 140 px on the Book page) and an optional `src` for later.

**Screens and routes**

| Route             | Screen         | Key content                                                                              |
| ----------------- | -------------- | ---------------------------------------------------------------------------------------- |
| /library          | Library        | Search, status chips, book list (mobile) or 3-column grid (desktop), Add book            |
| /books/\[id\]     | Book           | Cover, progress, 4 stat cards, Start reading, Log session, sessions list/table with Edit |
| /books/\[id\]/log | Log session    | Manual form with auto start page and page-check banner (dialog on desktop)               |
| /read             | Timer          | Elapsed time, start page field, Pause, Stop                                              |
| /read/finish      | Finish session | End page, pages/time/speed summary, Save (dialog on desktop)                             |
| /stats            | Stats          | Week/Month/Year switcher, 4 totals, pages-per-day bars, reading-days calendar, streaks   |
| /settings         | Settings       | Profile (name, nick), change password, sign out                                          |
| /sign-in          | Sign in        | Nick, password; link to Create account (no nav)                                          |
| /create-account   | Create account | Name, nick, password (no nav)                                                            |

`/` redirects to `/library`. Signed out, every other route goes to `/sign-in?next=<route>`.

## Tech stack

TypeScript everywhere, in an Nx monorepo on pnpm workspaces.

| Layer            | Choice                                                   |
| ---------------- | -------------------------------------------------------- |
| Runtime          | Node.js (current LTS)                                    |
| Monorepo         | Nx + pnpm workspaces; `@nx/next`, `@nx/node`, `@nx/vite` |
| Frontend         | Next.js (App Router), React                              |
| Styling / UI     | Tailwind CSS + shadcn/ui                                 |
| Data fetching    | TanStack Query                                           |
| Forms            | React Hook Form + Zod resolver                           |
| Charts           | Recharts (bar chart); calendar is a CSS grid             |
| Backend          | Express                                                  |
| Validation       | Zod, shared; `drizzle-zod` for table schemas             |
| Database         | SQLite via better-sqlite3                                |
| ORM / migrations | Drizzle ORM + drizzle-kit                                |
| Dates            | date-fns + @date-fns/tz                                  |
| Logging          | pino                                                     |
| Tests            | Vitest (unit), Supertest (API)                           |
| Lint / format    | ESLint with Nx module-boundary rule + Prettier           |

## Repo structure

Two apps and one shared library; only `api` touches the database, and `web` imports only from `shared`.

```
reading-tracker/
├─ apps/
│  ├─ web/                  # Next.js
│  │  └─ src/
│  │     ├─ app/            # routes: library, books/[id], read, stats
│  │     ├─ components/     # BookCover, BookRow, StatCard, PageCheckBanner, ...
│  │     ├─ components/ui/  # shadcn/ui
│  │     └─ lib/            # api client, query hooks
│  └─ api/                  # Express
│     ├─ src/
│     │  ├─ db/             # schema.ts, client.ts, seed.ts
│     │  ├─ routes/         # books, sessions, timer, stats
│     │  ├─ services/       # business logic per area
│     │  └─ middleware/     # validate, errors
│     ├─ drizzle/           # generated migrations
│     └─ drizzle.config.ts
├─ packages/
│  └─ shared/               # Zod schemas, types, rules, stats math
│     └─ src/
│        ├─ schemas/
│        ├─ rules/          # suggestStartPage, checkPages, validateSession
│        └─ stats/          # summary, daily, streaks
├─ CLAUDE.md
├─ nx.json
├─ pnpm-workspace.yaml
└─ package.json
```

## Conventions

Copy this section into `CLAUDE.md` at the repo root so Claude Code follows it in every session.

- Work one Build plan milestone at a time; finish its checks before starting the next.
- TypeScript strict mode; no `any`. Validate every request body and query with the shared Zod schemas.
- Business rules and stats math live only in `packages/shared` as pure functions; routes call services, services call shared rules.
- Every rule and stats function gets Vitest tests, including edge cases (no sessions, gaps, overlaps, sessions near midnight in America/Fortaleza).
- Every API route gets a Supertest test for success and validation errors.
- Never change the database by hand: edit `schema.ts`, then generate and run a migration.
- UI matches the Figma file; use the design tokens, never raw hex values in components.
- Keep it MVP: don't add features from the "Later" list.

**Commands**

| Task               | Command                                                         |
| ------------------ | --------------------------------------------------------------- |
| Install            | `pnpm install`                                                  |
| Run both apps      | `pnpm nx run-many -t dev -p web api`                            |
| Test everything    | `pnpm nx run-many -t test`                                      |
| Lint and typecheck | `pnpm nx run-many -t lint typecheck`                            |
| Only what changed  | `pnpm nx affected -t lint test typecheck`                       |
| New migration      | `pnpm nx run api:db-generate` then `pnpm nx run api:db-migrate` |
| Seed demo data     | `pnpm nx run api:db-seed`                                       |

The `db-*` and `typecheck` targets are added in milestone 1.

## Build plan

Eight milestones, each ending in a working app; give Claude Code one milestone per prompt and tick it off when its check passes.

- [x] **1. Workspace and tooling.** Nx workspace with `web`, `api`, `shared`; Tailwind + shadcn/ui with the design tokens; lint, typecheck and test targets; Next.js rewrite of `/api/*` to Express; `GET /api/health`.
  - Check: `run-many -t dev` serves both apps and `/api/health` answers through the web origin; lint, typecheck and test pass.
- [x] **2. Database.** Drizzle schema and first migration, seed script with demo books and sessions, `db-generate`, `db-migrate` and `db-seed` targets.
  - Check: a fresh database migrates and seeds, and `GET /api/books` returns the seeded books.
- [x] **3. Shared rules and stats.** suggestStartPage, validateSession, checkPages, summary, daily, streaks, all pure and tested.
  - Check: tests cover gap, overlap, no previous session, sessions near midnight in America/Fortaleza, and the Metrics formulas.
- [x] **4. Books.** Books API, BookCover placeholder, and the Library and Book screens (Book without sessions yet), mobile and desktop.
  - Check: add, edit, delete and filter books; screens match Figma at 390 and 1440 px.
- [x] **5. Manual logging.** Session API (check, create, update, delete), Log session form, sessions list/table with Edit, progress and auto status.
  - Check: with a previous session ending on page 174, starting at 181 shows the banner; "Start at page 175" fixes it; "Save anyway" saves; the first session moves the book to Reading.
- [x] **6. Timer.** Timer API, Read screen, Finish session, Now reading card and nav.
  - Check: start, reload the page, timer still running; stop with an end page saves the session; starting a second timer returns 409.
- [x] **7. Stats.** Stats endpoints and the Stats screen (switcher, totals, bar chart, calendar, streaks).
  - Check: numbers on screen match the seeded data computed by hand for one month.
- [x] **8. Polish.** Empty, loading and error states; keyboard focus and form labels; README with setup steps.
  - Check: a fresh clone runs with the README steps alone.
