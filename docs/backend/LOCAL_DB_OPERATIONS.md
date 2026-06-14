# AURELIA — Local DB Operations (Этап 15C)

Day-to-day operation of AURELIA's local PostgreSQL. Plain and safe: start, stop,
check health, back up — without ever touching the unrelated **dm-bot** database.

## The map (read this first)

| Thing | Where |
|---|---|
| AURELIA website | `http://localhost:5000` |
| **AURELIA database** | `localhost:6700` |
| AURELIA data dir | `C:\tmp\aurelia-postgres-data` |
| AURELIA password | inside `C:\Projects\Jewelry Store\.env` (`DATABASE_URL`) |
| **dm-bot database — DO NOT TOUCH** | `localhost:5432`, data dir `C:\tmp\dm-bot-postgres-data` |
| Postgres binaries | `C:\tmp\postgresql-16.11\pgsql\bin` |

- AURELIA always uses **port 6700** and its **own data dir**. It never uses
  5432 or 5433, and never touches dm-bot's data dir.
- **`.env` must never be committed** — it holds the dev DB password. It is
  gitignored. `.env.example` carries only a placeholder.
- The storefront is **not** wired to the DB yet; these are backend ops only.

## Where to find the password

Open `C:\Projects\Jewelry Store\.env`. The line
`DATABASE_URL="postgresql://aurelia:<password>@localhost:6700/aurelia?schema=public"`
contains it. Do not paste it into chats, commits, or screenshots.

## Commands

All commands run from `C:\Projects\Jewelry Store`.

### Start the database
```bash
npm run db:start
```
Starts the AURELIA cluster on 6700 (no-op if already running) and waits until it
accepts connections.

### Stop the database
```bash
npm run db:stop
```
Stops **only** the AURELIA cluster (by its data dir). It refuses to act if the
process on 6700 is not the AURELIA cluster, so dm-bot can never be hit.

### Check status
```bash
npm run db:status
```
Prints a safe summary: port, data dir, running yes/no, and a quick catalog
check (product count). No secrets printed.

### Check health
```bash
npm run db:health
```
Confirms PostgreSQL responds on 6700 **and** `npm run db:verify` passes. Exit
code 0 = healthy.

### Back up the catalog
```bash
npm run db:backup
```
Writes a timestamped custom-format dump to `backups/db/aurelia-<timestamp>.dump`.
`backups/` is gitignored. The dump holds catalog data only — no role passwords.

## Restore (intentionally NOT automated)

There is **no `db:restore` script on purpose** — an automated restore is the
easiest way to silently destroy data. To restore manually, deliberately, into a
**fresh/empty** database (never blindly over the live one):

```powershell
# 1) Make sure AURELIA DB is running (port 6700).
# 2) Inspect what a dump contains WITHOUT changing anything (dry-run):
& "C:\tmp\postgresql-16.11\pgsql\bin\pg_restore.exe" --list "backups\db\aurelia-<timestamp>.dump"

# 3) Restore into a NEW empty database you created for the purpose, e.g. aurelia_restore.
#    Do NOT restore over the live 'aurelia' DB unless you fully intend to.
#    (Creating that DB needs superuser — see LOCAL_DB_SETUP.md.)
```

Reset/drop/`--clean` restores are deliberately omitted to avoid accidental loss.

## Production note

This is a **local development** setup only. A production database will be a
separate decision (managed Postgres, real secrets management, migrations in CI,
backups/retention policy) — not these scripts.

## Safety guarantees built into the scripts

- Every script is hard-coded to port **6700** and data dir
  **`C:\tmp\aurelia-postgres-data`**.
- `stop` verifies the target is the AURELIA cluster (data dir match, not
  `dm-bot`) before doing anything.
- No script references port 5432, 5433, or `dm-bot-postgres-data`.
- No script prints the password or full `DATABASE_URL`.
- No reset / drop / destructive restore.
