# BIS Roadmap

Where the build stands and what is left. Details for each phase are in the linked file. Architecture and the reasons for each choice are in [BUILD_README.md](BUILD_README.md).

## Status

| Phase | What | Status | Details |
| --- | --- | --- | --- |
| 1 | Screens with sample data | Done | n/a |
| 2 | Scoring engine | Done, except real result sheets as fixtures | [PHASE2_README.md](PHASE2_README.md) |
| 3 | Venue backend | Built; four items open | [VENUE.md](VENUE.md) |
| 4 | Offline safety | Built; rehearsed on this machine, not yet on real phones | [VENUE.md](VENUE.md) |
| 5 | Cloud backend and sync | Built; not yet on a real server | [PHASE5_README.md](PHASE5_README.md), [deploy/README.md](deploy/README.md) |
| 6 | Registration and payments | Built; Messenger messages not yet tried against Facebook | [PHASE6_README.md](PHASE6_README.md) |
| 7 | Testing and pilot | Tools and tests built; the pilot itself is not done | [PHASE7_README.md](PHASE7_README.md), [PILOT.md](PILOT.md) |

## Decisions still needed from the client

| Item | Needed by | Why |
| --- | --- | --- |
| Real result sheets with every adjudicator's marks | Phase 3 testing | The scoring engine is only checked against the Skating System guide's examples |
| Approved points table | Phase 3 | The table in the app is a suggestion |
| Rule for ranking points when places are shared | Phase 3 | The app splits the points of the shared places equally; not confirmed against WDSF |
| How an unbreakable tie in a final is settled | Phase 3 | Built so the chairperson confirms either keeping the shared place or a tie-break order typed in by the scrutineer; the organizer should confirm that is their rule |
| GCash, Maya and bank account details for entry fees | Phase 6 | Shown to clubs when they register |
| Which paper forms must still be printed | Phase 3 | Heat lists, qualified lists, scores sheets and final results are built |

## Phase 3: Venue backend (built)

Summary:

- [x] 0. Backend package: Fastify, config, health endpoint, scripts
- [x] 1. Database: Drizzle schema, WAL, migrations and the sample-data seed
- [x] 2. Sign-in and roles: staff passwords, adjudicator PINs, httpOnly cookie
- [x] 3. Admin and secretariat endpoints
- [x] 4. Round control: the scrutineer starts rounds
- [x] 5. Marks: validation, safe resubmission, paper-sheet entry
- [x] 6. Scoring in the server: recalls, ties, approve, publish
- [x] 7. Real-time: Socket.IO, heartbeats, guest read-only room
- [x] 8. MC announcements from real approvals
- [x] 9. Audit log and backups
- [x] 10. Frontend switch from mocks to the API
- [x] 11. Printing with real data
- [x] 12. Testing: full competition, permissions, concurrency, crash
- [x] 13. Running at the venue

Open from Phase 3 (all since built): age group from birth year, the unbreakable-tie decision, the paper-marks screen, and enforcing paid entries when a round starts.

## Phase 4: Offline safety (built)

Goal: nothing is lost when Wi-Fi drops, a phone dies or a refresh happens mid-round.

- [x] Offline copy of the app (PWA) with a service worker, manifest and icons, plus optional HTTPS. Browsers only keep it over HTTPS, so by default phones do not
- [x] Marks are saved on the phone first (IndexedDB), including answers in progress, and survive a refresh or a closed browser
- [x] Resend automatically after a Wi-Fi drop; the server stores a repeat once
- [x] The scrutineer's board shows a quiet phone and a phone holding unsent marks
- [x] Paper fallback: printable blank sheets and a Paper marks screen to type in an adjudicator's sheet
- [x] Backup device: `restore` command for Laptop 3, takeover steps and a rehearsal checklist
- [x] Tested: server stopped and restarted mid-round, browser killed, a lost reply, a refused send
- [x] Rehearsal run for real on this machine (`pnpm rehearsal`: 19 steps, real servers and Chrome, including a venue syncing with a cloud server); it found and fixed seven problems
- [ ] Run the by-hand rehearsal on the real phones and laptops (offline copy, certificate on Android and iPhone, takeover timing)

## Phase 5: Cloud backend and sync (built)

Goal: the same server runs online, and venue and cloud stay in step. Details and decisions in [PHASE5_README.md](PHASE5_README.md).

- [x] Cloud mode of the same server, run in Docker behind Caddy (HTTPS). It uses SQLite, not PostgreSQL: see the decisions in PHASE5_README.
- [x] Upload queue: every change to results, ranking points, entries and scratches is captured into the `outbox` by database triggers and sent when the cloud can be reached. Safe to repeat.
- [x] Download before an event: the paid entries, panels and history rankings of one competition.
- [x] Public pages read from the cloud's database (same pages).
- [x] Conflict rule: a competition downloaded by a venue is held; entries and payments close online until it is released.
- [x] Sync status at the venue and the Cloud sync screen.
- [x] Hosting files and online backups (`deploy/`).
- [x] Sync step in `pnpm rehearsal`: a cloud server and a venue on their own databases; download, a round, the cloud lost and found again, release
- [ ] Put it on a real server and connect the real venue laptop
- [x] Copy the online backups to a second place every day (`docker compose --profile offsite up -d`; needs a place to copy to)
- [x] A screen for an admin to take back a competition from a lost venue (Competitions, online)

## Phase 6: Registration and payments (cloud) (built, except emails)

Goal: clubs register and pay before the event, and the admin confirms payments by hand. BIS never handles card details or money. Details and decisions in [PHASE6_README.md](PHASE6_README.md).

- [x] Club accounts: sign up, sign in, manage dancers, change password; an admin can give a temporary one.
- [x] Register dancers to events, see the total fee, see payment details (set by the organizer on the Fees and payment details screen).
- [x] Upload proof of payment (screenshot and reference number), visible only to admins and the club that sent it.
- [x] Admin payment checking: approve, or reject with a reason; every decision is logged with name and time.
- [x] Only approved or paid-at-venue entries can dance: the download takes only those, and a round will not start with an unpaid entry in its event.
- [x] Data Privacy Act of 2012: consent at sign-up, a privacy notice, no birth dates, erasure of a club's contact details, payment proofs deleted 90 days after the competition.
- [x] Fake club passwords, fees and payment accounts removed from the real server (only the sample data has them).
- [x] Messages to clubs when a payment is approved or rejected: Facebook Messenger (chosen by the client). Built and tested with a stand-in for Facebook; set-up steps in deploy/README.md. Needs trying with the real Page, and may need Meta app review.

## Phase 7: Testing and pilot

Details in [PHASE7_README.md](PHASE7_README.md); the plan for the real event is [PILOT.md](PILOT.md).

- [x] A whole competition run through BIS end to end (the sample one; `backend/src/fullcompetition.test.ts`)
- [ ] The same with real sheets from a past competition, once the client provides them
- [x] Load test: 10 phones marking at once with 100 spectators reading (`pnpm loadtest`), no marks lost or doubled
- [ ] Run the load test and the rehearsal on the real laptops and the by-hand rehearsal on the real phones
- [x] Tool to compare BIS with the paper result sheets (`results:compare`)
- [ ] Pilot at a real competition, with the current method running alongside, and compare every result
- [x] Training: a one-page guide per role in [guides/](guides/)
- [ ] Rehearsal with the actual secretariat, scrutineer, chairperson and adjudicators, using the guides (and fix any step a guide gets wrong)
- [ ] Fix list from the pilot, then a second, smaller event before the system is relied on alone

## Carried over from earlier phases

- [ ] Add each real result sheet as a fixture in `packages/scoring/fixtures/`.
- [ ] Confirm the scoring engine's Rules 1 and 5-11 against the current WDSF rulebook and record the version used.
- [ ] Confirm the shared-place ranking points rule (`pointsForRange` in `packages/scoring/src/points.ts`).
- [ ] Store shared place ranges on results so printouts can show a tie, not only its best place.
- [x] Chairperson decision flow for an unbreakable tie in a final: built (see below). The rule for settling it is the organizer's to confirm.
- [ ] Confirm the age-group limits in `packages/shared/src/ageGroup.ts` with the organizer.
