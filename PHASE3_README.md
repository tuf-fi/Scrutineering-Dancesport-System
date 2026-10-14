# Phase 3: Venue Backend

Build `backend/`: the Node.js server that runs a competition on the venue laptop with no internet, and replace the sample data behind `frontend/src/api/` with real calls. See [BUILD_README.md](BUILD_README.md) for the architecture, [FLOW_README.md](FLOW_README.md) for how a competition runs, and [PHASE2_README.md](PHASE2_README.md) for the scoring engine this phase calls.

Phase 3 is **venue mode only**: SQLite, no cloud, no payments, no sync. Cloud mode, the upload queue and registration come in Phases 5 and 6. Offline safety on the phones (the PWA and the outbox that survives a refresh) is Phase 4, but the server must be built so Phase 4 can add it without changes.

## Starting point

- `frontend/src/mocks/api.ts` exposes 89 functions. Each one becomes a backend endpoint. `frontend/src/api/index.ts` is the single switch point, so screens and hooks should not change.
- `packages/scoring` is finished. The server calls it for recalls, finals, shared places and ranking points. It never reimplements scoring.
- `packages/shared` holds the data shapes. The backend and frontend both use them.
- The `// TODO` comments left in the mock layer are the checklist of what "real" means. Each is mapped to a to-do below.
- [CLAUDE.md](CLAUDE.md) says "do not build the backend yet". Update it when this phase starts.

## Open decisions

Confirm these before step 1. Each has a recommended default so work is not blocked.

| Question | Recommended default |
| --- | --- |
| Web framework | Fastify, as in BUILD_README |
| Database access | Drizzle ORM with `better-sqlite3`, WAL on. Schema written once so Phase 5 reuses it for PostgreSQL |
| Real-time | Socket.IO, as in BUILD_README |
| Staff passwords | Argon2 or bcrypt hashes, never stored plain |
| Session | Signed JWT in an httpOnly cookie for staff; the same for adjudicators after PIN sign-in |
| Who puts a round on the floor | The scrutineer, with a "Start round" action. Replaces the demo controls |
| Who confirms a tie | Scrutineer proposes, chairperson confirms (already the flow in the screens) |
| IDs | UUIDs or ULIDs, so venue and cloud rows never collide when Phase 5 syncs them |
| Time | Store UTC ISO strings; the venue laptop's clock is the source of truth on the day |

## Scope

- In: venue server, SQLite schema, sign-in for staff and adjudicators, the 89 endpoints, Socket.IO events, validation, audit log, backups, the frontend switch from mocks to the API, the scrutineer start-round flow.
- Out: cloud server, PostgreSQL, payments and receipts, club accounts on the cloud, the public website's cloud data, sync, PWA install and the phone outbox (Phase 4).
- Club portal and payment endpoints exist in the mock API. In this phase they get a thin local version (read-only or stubbed with a clear `// TODO:` pointing to Phase 6) so the frontend still runs. They are not built for real.

## Status: built

Phase 3 is built and tested: 111 backend tests (including the real frontend client talking to the real server, a process kill mid-save, and a restore from backup), 197 frontend tests (22 of them for the real client and socket), 50 scoring tests, and a smoke test of the production build against a seeded database. Three things were done differently from the plan, and four were left open; both are marked below.

**Done differently**
- **One call route.** Instead of 85 separate URLs, the server has `POST /api/call/<name>` with `{ "args": [...] }`, plus separate `/api/auth/*` routes for signing in. Every function has its allowed roles in one table (`backend/src/registry.ts`), and a test checks the table, the server and the client against one list (`API_FUNCTIONS` in `@bis/shared`).
- **The mocks were kept**, not deleted: they run the frontend tests and the client preview. Real builds contain no sample data.
- **A random cookie secret** is created beside the database on first start, so it works without configuration and a restart does not sign anyone out.

**Left open**
- Age group from birth date; the unbreakable-tie decision; the screen for typing in an adjudicator's paper marks (the server endpoint exists; the screen is Phase 4); and enforcing "only paid entries can dance" when a round starts (a policy decision for the client).

## To-dos

Progress: steps 0 and 1 are done except the seed script. Install of `better-sqlite3` is proven on this machine; prove it again on Laptop 2.

### 0. Backend package
- [x] Create `backend/` as `@bis/backend` (the workspace already lists it): strict TypeScript, Vitest, Fastify.
- [x] Depend on `@bis/shared` and `@bis/scoring`.
- [x] Config: port, database file path, `MODE=venue`, cookie secret, venue Wi-Fi addresses. Read from environment with a documented `.env.example`.
- [x] Root scripts: `pnpm dev` runs backend and frontend together, `pnpm test` runs everything.
- [x] Health endpoint for the "venue online/offline" indicator.

### 1. Database
- [x] Drizzle schema for every table in the BUILD_README data model: competitions, events, competitors, entries, clubs, payments, adjudicators, panels, rounds, heats, marks, results, points_table, ranking_points, staff_users, audit_log, outbox.
- [x] Turn on WAL and a busy timeout so many devices can read while marks are saved.
- [x] Migrations checked in (`backend/drizzle/`), and a first-run step that creates an empty database.
- [x] Results store the shared range in the database (`place_from`, `place_to`). Still to do: add the same fields to `Result` in `@bis/shared` when the API returns them.
- [x] Seed script (`pnpm seed`) loads the sample competition into an empty database from `backend/seed/sample-data.json`, a snapshot of the frontend's sample data. The sample app and the tests keep using `frontend/src/mocks/` (see step 10)

### 2. Sign-in and roles
- [x] Staff accounts with hashed passwords; the roles are admin, secretariat, scrutineer, chairperson, MC.
- [x] Adjudicators sign in with a PIN per competition; the PIN is valid only for that competition's panel.
- [x] JWT in an httpOnly cookie. Replaces the localStorage session in `frontend/src/stores/auth.ts` and the fake sign-in in the mock API.
- [x] Every endpoint checks the role. An adjudicator can only read their own round and submit their own marks; the guest network can only read results and rankings.
- [x] Remove the sample credentials helper (`getSampleCredentials`) and the dev sign-in hint.
- [x] Rate-limit PIN and password attempts.

### 3. Admin and secretariat endpoints
- [x] Competitions, staff users, adjudicators, PIN generation, panels, points table.
- [x] Events, schedule (move events), competitors, back numbers (assign and import from CSV; the server parses the file, including quoted fields with commas), scratches, late entries, paid-at-venue.
- [ ] A competitor's age group comes from their birth date. Not built: the age group is stored as entered (`TODO` in the schema) until the real registration form collects a birth date
- [x] When the admin edits the points table, recalculate ranking points already earned (`rankingPoints` in `@bis/scoring`), instead of leaving old points as the mock does.

### 4. Round control
- [x] Scrutineer **starts a round**: validates the field, creates or updates heats, and puts the round on the floor. Replaces the demo pointer and `DemoControls`.
- [x] The field of a round is the previous round's recalled competitors (the mock takes the lowest back numbers; remove that).
- [x] Heat setup: save and renumber heats; refuse changes once a round is approved.
- [x] Round status moves `pending → marking → review → approved → published`, and only forward.

### 5. Marks
- [x] Adjudicator submit endpoint. Validate exactly the recall number of X marks per dance in early rounds, and each place used once in a final.
- [x] Marks are write-once per adjudicator per round. A resubmission after a Wi-Fi drop with the same data is accepted as a repeat (idempotent) so Phase 4 can resend safely.
- [x] Marks are stamped with the server's time. The device is not recorded
- [x] The scrutineer can enter marks from a paper sheet for an adjudicator (the Phase 4 paper fallback needs this endpoint; build it now, with an audit entry).

### 6. Scoring in the server
- [x] Recall table and Skating System table are computed by `@bis/scoring` on each request from the stored marks, using only adjudicators who have submitted so far (provisional until all have). Move the adapter logic from `frontend/src/mocks/scrutinizing.ts` into the backend.
- [x] Tie at the recall cutoff: scrutineer proposes fewer or more, chairperson confirms; both are logged.
- [ ] Unbreakable tie in a final (shared place from Rule 11): the chairperson decides, and the decision is recorded. Not built: a shared place is approved as shared and shown as such (e.g. "2nd–3rd"). The client needs to say how a tie for 1st is settled before this can be built
- [x] Approve: lock the marks, compute results with `placeFinal` and `placeEliminated`, store `results` and `ranking_points` in one transaction.
- [x] Publish: make the round public and broadcast it.
- [x] Re-opening an approved round is refused; corrections are a new audited action by the scrutineer with the chairperson's confirmation.

### 7. Real-time
- [x] Socket.IO server with rooms per role and per round.
- [x] Events: adjudicator submitted, round started, round status changed, tie proposed and confirmed, results published, rankings updated.
- [x] Replaces `frontend/src/mocks/realtime.ts` and the polling noted in `useAdjudicating.ts` and `useScrutineer.ts`.
- [x] Heartbeat per phone; the scrutineer's live board marks a phone as quiet after a timeout. Replaces the fake flag in `LivePage.tsx`.
- [x] The connection indicator (`stores/connection.ts`) follows the real socket.
- [x] Guest network clients join a read-only room that receives only published results and rankings.

### 8. MC and announcements
- [x] Announcements are created when the scrutineer approves or publishes a round: calls, recalls, finalists, and results from last place up. Replaces the replayed sample.

### 9. Audit log and backups
- [x] Every mark, tie decision, approval, publish, score change and admin change is written to `audit_log` with who, what, when and the before/after values.
- [x] Automatic database backup on a timer and after every approval, to a USB path and to Laptop 3. Verify a backup can be restored.
- [x] A clear message on the scrutineer screen when a backup target is missing.

### 10. Frontend switch
- [x] Replace `frontend/src/api/index.ts` with real `fetch` calls and the Socket.IO client, keeping the same function names so hooks and screens do not change.
- [x] The sample API stays behind `pnpm dev:sample`, the client preview (`pnpm build:sample`) and the frontend tests, which run on it. The real client is checked against the server's function list by a contract test (`frontend/src/api/client.test.ts`), so the two cannot drift
- [x] Move the TanStack Query polling to socket-driven invalidation.
- [x] Show server error messages the same way the screens already show mock errors.

### 11. Printing
- [x] Printouts keep working: they read through the same API. Check heat lists, qualified lists, scores sheets, final results and blank mark sheets with real data, and show shared places as such.

### 12. Testing
- [x] Unit tests per service and endpoint; use an in-memory SQLite database.
- [x] A full-competition test: create an event, enter competitors, run every round with scripted adjudicators, resolve a tie, approve and publish, and check results and ranking points.
- [x] Permissions test: each role can do only its own actions.
- [x] Concurrency test: 10 adjudicators submit at the same time and every mark is stored once.
- [x] Crash test: stop the server mid-round, restart, and confirm no submitted mark is lost.
- [x] The existing frontend tests pass unchanged on the sample API, and the real client has its own contract tests; the backend tests drive the real API end to end
- [ ] Re-run the Phase 2 scoring fixtures through the API. Not done as such: the guide's worked examples are tested in `packages/scoring`; the API test runs a whole competition with a tie at the cutoff and a final

### 13. Running at the venue
- [x] One command (`pnpm venue`) starts the server on Laptop 2 and serves the built frontend, so the other devices only need a browser.
- [x] Instructions are in [VENUE.md](VENUE.md): `pnpm venue`, the firewall rule, router notes and a checklist. The server is not yet set up to start by itself when Windows starts
- [x] Router setup notes: staff network and the read-only guest network, and which addresses each device opens.

## Done when

- A full competition (several events, early rounds, a tie, a multi-dance final, publish) runs end to end with real marks on a phone and results on every screen, with the frontend using no mock data.
- 10 phones can submit at once, and a server restart loses no submitted mark.
- Every action in the audit log, and a restored backup matches the live database.
- The scoring fixtures from Phase 2 give the same places through the API.

## Risks

- **Real data is still missing.** Collect result sheets from the client as early as possible so the engine is checked before the pilot, not at it.
- **Clock and device problems on the day.** Mark times come from the server, not the phone, so a wrong phone clock cannot reorder anything.
- **Windows laptop.** `better-sqlite3` needs a prebuilt binary or build tools on Windows. Prove the install on the actual Laptop 2 early.
- **Scope creep from the club and payment screens.** Keep them stubbed until Phase 6.
