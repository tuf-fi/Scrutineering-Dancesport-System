# Phase 5: Cloud Backend and Sync

Goal: the same server runs online, and the venue and the cloud stay in step. See [PHASE4_README.md](PHASE4_README.md) for the offline safety this builds on, [VENUE.md](VENUE.md) for running the venue laptop and [deploy/README.md](deploy/README.md) for the online server.

## Status: built

| Step | What | Status |
| --- | --- | --- |
| 1 | Cloud mode of the same server (`MODE=cloud`) | Done |
| 2 | Capture of every change into an upload queue (the outbox) | Done |
| 3 | Download of a competition before the event | Done |
| 4 | Upload of results, ranking points, entries and scratches | Done |
| 5 | Conflict rules: one venue runs a competition at a time | Done |
| 6 | Public pages read from the cloud | Done (they are the same pages, reading the cloud's database) |
| 7 | Sync status and the Cloud sync screen | Done |
| 8 | Hosting: Dockerfile, Caddy for HTTPS, backups | Built and run in Docker on this machine; not yet on a real server |

Tests added: 44 backend (19 on the sync building blocks, 25 with a real cloud server and a real venue server talking over HTTP), 3 frontend. Suites: 180 backend, 237 frontend, 50 scoring.

## Decisions

1. **The cloud runs on SQLite, not PostgreSQL.** BUILD_README planned PostgreSQL, but every service is written for SQLite's synchronous calls; PostgreSQL would mean rewriting all of them to be asynchronous, and splitting the two code bases the roadmap wants kept as one. One online server with one file, backed up after every change, is enough for registration, payments and results at this size. Revisit it if the cloud ever needs more than one server.
2. **One venue runs a competition at a time.** Downloading a competition *holds* it on the cloud. While held, entries, payments, events and panels cannot change online (the screens say who holds it), so there is nothing to merge afterwards: the venue is the only writer. Reading is never closed. Releasing it, or an admin taking it back with `unlockCompetition` if the venue laptop is lost, ends the hold.
3. **Only paid entries are downloaded.** Entries still unpaid or waiting for checking stay on the cloud; the download says how many were left out. Late entries are made at the venue by the secretariat and go up as normal changes.
4. **Changes are captured by the database, not by each function.** Triggers on the 13 uploaded tables write each change into the `outbox` table in the same transaction, so no write path can forget to queue a change. They are on only for a laptop set up for the cloud and only after a download. A test fails if the triggers drift from the schema (`pnpm --filter @bis/backend db:sync-migration` rewrites them).
5. **Sending is safe to repeat.** The cloud applies each change as an upsert or delete by key, in one transaction, and ignores columns it does not know. A whole batch that fails is retried; a batch that arrives twice changes nothing. Waiting changes are kept in the outbox until the cloud has accepted them.
6. **Private data stays where it is.** Payment receipts (images), club password hashes and the venue's floor and hold state are never part of a download or an upload. Each venue has its own secret, so one can be cut off without touching the others.
7. **The venue never depends on the cloud.** Running rounds, marking, publishing and printing do not call the cloud. If it cannot be reached, changes wait and a notice shows how many.

## What was built

### Server
- `backend/src/sync/tables.ts`: the tables sent up and down, and the columns left out.
- `backend/src/sync/triggers.ts`, migration `0003_sync_capture.sql`: the capture triggers.
- `backend/src/sync/apply.ts`: applies uploaded changes and downloaded snapshots.
- `backend/src/sync/snapshot.ts`: builds the download.
- `backend/src/sync/cloud.ts`: the routes the cloud answers (`/api/sync/ping`, `competitions`, `pull`, `upload`, `release`), signed with a bearer secret and the venue's name.
- `backend/src/sync/venue.ts`: the venue's side: download, sending in batches of 200 every 20 seconds and 2 seconds after a change, status, queue-everything-again, release.
- `backend/src/services/sync.ts`: the functions the screens call. A cloud refusal of the venue's secret is shown as such and never as "sign in again".
- Functions that only make sense at the venue answer "not available here" online (404), and `unlockCompetition` answers that at the venue. The permission tests cover both.

### Screens
- **Cloud sync** (admin and secretariat): whether the cloud answers, changes waiting, the last time something was sent, the list of competitions on the cloud with Download. Admins also get Send all again and Release.
- A notice on the staff screens when changes are waiting and the cloud cannot be reached.

### Online server
`deploy/` holds the Dockerfile, a compose file with Caddy (HTTPS certificate and renewal) and the steps to set it up. The image runs the same program with `MODE=cloud`, keeps the database and its backups in one volume, and has a health check.

## How a competition goes

1. Online, the admin creates the competition and clubs enter and pay as usual (Phase 6 completes this).
2. A week before, on Laptop 2 with internet: Cloud sync, Download. The competition is now held by this venue.
3. At the venue nothing changes for the staff. Results and ranking points go up on their own when the internet is there.
4. Afterwards: Cloud sync should say nothing is waiting, then an admin releases the competition. The public pages show the results from the moment they arrive.

## Not done

- Real hosting (a VPS, DNS, copies of the online backups to another place) and a run against it from the real venue laptop. Add a sync step to `pnpm rehearsal`.
- Rankings are uploaded as results come in; the download of rankings from other competitions for seeding is limited to the history rows needed for the entries downloaded.
- No screen yet for an admin to take back a competition online (the `unlockCompetition` function exists and is tested).
- Phase 6 items: club accounts with real email, payment proof storage, privacy notice.
