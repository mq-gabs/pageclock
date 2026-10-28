# Reading Tracker

Track the books you read, log reading sessions with a timer or by hand, and see your pages, reading time, speed, reading days and streaks.

It's a single-user app that runs on your machine: a Next.js web app, an Express API and a SQLite file, in an Nx + pnpm monorepo. [SPEC.md](SPEC.md) describes the product and its rules.

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
pnpm nx run api:db-migrate   # creates apps/api/data/reading-tracker.db
pnpm nx run api:db-seed      # optional: five demo books with sessions from the last 40 days
pnpm dev
```

Open <http://localhost:3000>. The API listens on <http://localhost:3333/api>. The web app forwards `/api/*` to it, so the browser only ever talks to port 3000.

Stop both apps with `Ctrl+C`.

> `db-seed` **wipes the database** and loads the demo library, with dates relative to today. Skip it to start empty.

## Everyday commands

| Task                                                         | Command                                          |
| ------------------------------------------------------------ | ------------------------------------------------ |
| Run web and API in watch mode                                | `pnpm dev`                                       |
| Run all tests                                                | `pnpm test`                                      |
| Lint and typecheck                                           | `pnpm lint`                                      |
| Only what changed since `main`                               | `pnpm nx affected -t lint test typecheck`        |
| Format                                                       | `pnpm format`                                    |
| Apply database migrations                                    | `pnpm nx run api:db-migrate`                     |
| Create a migration after editing `apps/api/src/db/schema.ts` | `pnpm nx run api:db-generate`, then `db-migrate` |
| Reset to the demo data                                       | `pnpm nx run api:db-seed`                        |

Nx caches lint, typecheck and test results; add `--skip-nx-cache` to force a rerun.

## Production build

```sh
pnpm nx run-many -t build -p web api
pnpm nx run-many -t start -p web api
```

Run `db-migrate` against the same database first. The API never migrates on startup.

## Configuration

Everything has a working default. To change a setting, set an environment variable in the shell that runs the command. For example: `APP_TIMEZONE=Europe/Lisbon NEXT_PUBLIC_APP_TIMEZONE=Europe/Lisbon pnpm dev`.

| Variable                   | App | Default                     | What it does                                                             |
| -------------------------- | --- | --------------------------- | ------------------------------------------------------------------------ |
| `APP_TIMEZONE`             | API | `America/Fortaleza`         | Time zone used to group sessions into days, weeks, months and years.     |
| `NEXT_PUBLIC_APP_TIMEZONE` | web | `America/Fortaleza`         | Time zone for dates and times in forms. Keep it equal to `APP_TIMEZONE`. |
| `DATABASE_URL`             | API | `./data/reading-tracker.db` | SQLite file, relative to `apps/api`.                                     |
| `PORT` / `HOST`            | API | `3333` / `localhost`        | Where the API listens.                                                   |
| `API_URL`                  | web | `http://localhost:3333`     | Where the web app forwards `/api/*`.                                     |
| `LOG_LEVEL`                | API | `info` (`silent` in tests)  | pino log level.                                                          |

## Project layout

```
apps/web         Next.js App Router UI (Tailwind, shadcn/ui, TanStack Query, Recharts)
apps/api         Express API, Drizzle ORM on SQLite (better-sqlite3), migrations in apps/api/drizzle
packages/shared  Zod schemas, business rules and stats math, shared by web and API
```

Business rules and stats calculations live only in `packages/shared` as pure, tested functions. [CLAUDE.md](CLAUDE.md) has the conventions and implementation notes for contributors.

## Troubleshooting

- **`no such table: books`**: the database hasn't been migrated. Run `pnpm nx run api:db-migrate`.
- **`better-sqlite3` fails to load** after switching Node versions: run `pnpm rebuild better-sqlite3`. Its native build is allowed in `pnpm-workspace.yaml` (`allowBuilds`).
- **Port 3000 or 3333 already in use**: stop the other process. To move the API, set `PORT`, and set `API_URL` to match.
- **The web app shows "Can’t reach the server"**: the API isn't running or crashed. Check the `api:` lines in the `pnpm dev` output.
