<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/wordmark/svg/pageclock-wordmark-on-dark.svg" />
    <img src="assets/brand/wordmark/svg/pageclock-wordmark-color.svg" alt="Pageclock" height="48" />
  </picture>
</h1>

Track the books you read, log reading sessions with a timer or by hand, and see your pages, reading time, speed, reading days and streaks.

It's a single-user app that runs on your machine: a Next.js web app, an Express API and a SQLite file, in an Nx monorepo with a single root `package.json` (pnpm). [SPEC.md](SPEC.md) describes the product and its rules.

## Requirements

- **Node.js 24** (the current LTS). With nvm: `nvm use` reads [.nvmrc](.nvmrc).
- **pnpm 11**. The easiest way is Corepack, which ships with Node 24 and installs the exact version pinned in `package.json`:

  ```sh
  corepack enable
  ```

  Without Corepack: `npm install -g pnpm@11`.

- **git**.

No database server is needed: SQLite stores everything in a file inside the repo.

## Setup

```sh
git clone <repository-url> reading-tracker
cd reading-tracker
pnpm install
pnpm api:db-migrate   # creates apps/api/data/reading-tracker.db
pnpm api:db-seed      # optional: a demo account with five books and 40 days of sessions
pnpm dev
```

Open <http://localhost:3000> and create an account, or sign in to the demo account (nick `demo`, password `pageclock`) if you seeded. The API listens on <http://localhost:3333/api>. The web app forwards `/api/*` to it, so the browser only ever talks to port 3000.

Stop both apps with `Ctrl+C`.

Settings come from `apps/api/.env.local` (`PORT`, `HOST`, `DATABASE_URL`, `LOG_LEVEL`) and `apps/web/.env.local` (`API_URL`, read at build time). Both files are optional and gitignored; copy each app's `.env.example` to start one (`cp apps/api/.env.example apps/api/.env.local`); every setting has a default, and real environment variables override the files.

> `db-seed` **wipes the database** (every account too) and loads the demo account and library, with dates relative to today. Skip it to start empty.

## Everyday commands

| Task                                                         | Command                                            |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Run web and API in watch mode                                | `pnpm dev`                                         |
| Run all tests                                                | `pnpm test`                                        |
| Lint and typecheck                                           | `pnpm lint`                                        |
| Only what changed since `main`                               | `pnpm affected`                                    |
| Format                                                       | `pnpm format`                                      |
| Apply database migrations                                    | `pnpm api:db-migrate`                              |
| Create a migration after editing `apps/api/src/db/schema.ts` | `pnpm api:db-generate`, then `pnpm api:db-migrate` |
| Reset to the demo data                                       | `pnpm api:db-seed`                                 |

Each project command also has its own script, named `<project>:<target>`: for example `pnpm web:dev`, `pnpm api:test`, `pnpm shared:typecheck`. Extra arguments go to the underlying tool (`pnpm api:test src/routes/books.test.ts`). The full list is in the root [package.json](package.json).

Nx caches lint, typecheck and test results; add `--skip-nx-cache` to force a rerun.

## Production build

```sh
pnpm build
pnpm start
```

Run `db-migrate` against the same database first. The API never migrates on startup.

## Configuration

Everything has a working default. To change a setting, set an environment variable in the shell that runs the command. For example: `PORT=4000 API_URL=http://localhost:4000 pnpm dev`. Dates and days are always UTC.

| Variable        | App | Default                     | What it does                         |
| --------------- | --- | --------------------------- | ------------------------------------ |
| `DATABASE_URL`  | API | `./data/reading-tracker.db` | SQLite file, relative to `apps/api`. |
| `PORT` / `HOST` | API | `3333` / `localhost`        | Where the API listens.               |
| `API_URL`       | web | `http://localhost:3333`     | Where the web app forwards `/api/*`. |
| `LOG_LEVEL`     | API | `info` (`silent` in tests)  | pino log level.                      |

## Project layout

```
apps/web         Next.js App Router UI (Tailwind, shadcn/ui, TanStack Query, Recharts)
apps/api         Express API, Drizzle ORM on SQLite (better-sqlite3), migrations in apps/api/drizzle
packages/shared  Zod schemas, business rules and stats math, shared by web and API
assets/brand     Pageclock logo files (symbol, wordmark, app icons, favicons); see its README
```

All dependencies live in the root `package.json`. Each project's Nx targets are in its `project.json`.

Business rules and stats calculations live only in `packages/shared` as pure, tested functions. [CLAUDE.md](CLAUDE.md) has the conventions and implementation notes for contributors.

## Troubleshooting

- **`no such table: books`**: the database hasn't been migrated. Run `pnpm api:db-migrate`.
- **`better-sqlite3` fails to load** after switching Node versions: run `pnpm rebuild better-sqlite3`. Its native build is allowed in `pnpm-workspace.yaml` (`allowBuilds`).
- **Port 3000 or 3333 already in use**: stop the other process. To move the API, set `PORT`, and set `API_URL` to match.
- **The web app shows "Can’t reach the server"**: the API isn't running or crashed. Check the `api:` lines in the `pnpm dev` output.
