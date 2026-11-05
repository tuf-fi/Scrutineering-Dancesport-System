# BIS Roadmap

Where the build stands and what is left. [STATUS.md](STATUS.md) has the short, current list of what is left and what is unclear. Details for each phase are in the linked file. Architecture and the reasons for each choice are in [BUILD_README.md](BUILD_README.md).

## Status

| Phase | What | Status | Details |
| --- | --- | --- | --- |
| 1 | Screens with sample data | Done | n/a |
| 2 | Scoring engine | Done, except real result sheets as fixtures | [PHASE2_README.md](PHASE2_README.md) |
| 3 | Backend | Built | [deploy/README.md](../../deploy/README.md) |
| 4 | Offline safety | Removed: online only | n/a |
| 5 | Cloud backend and sync | Removed: online only; the server is built but not yet on a real host | [deploy/README.md](../../deploy/README.md) |
| 6 | Registration and payments | Built, then changed: the secretariat registers teams from the entry forms. Coach, team and athlete accounts can also send an entry with a payment screenshot, which the secretariat approves. Messenger was removed | n/a |
| 7 | Testing and pilot | Tools and tests built; the pilot itself is not done | [PHASE7_README.md](PHASE7_README.md), [PILOT.md](../operations/PILOT.md) |

## Decisions still needed from the client

| Item | Needed by | Why |
| --- | --- | --- |
| Real result sheets with every adjudicator's marks | Phase 3 testing | The scoring engine is only checked against the Skating System guide's examples |
| Approved points table | Phase 3 | The table in the app is a suggestion |
| Rule for ranking points when places are shared | Phase 3 | The app splits the points of the shared places equally; not confirmed against WDSF |
| How an unbreakable tie in a final is settled | Phase 3 | Built so the chairperson confirms either keeping the shared place or a tie-break order typed in by the scrutineer; the organizer should confirm that is their rule |
| GCash, Maya and bank account details for entry fees | Phase 6 | Shown to athletes when they pay their membership |
| Which paper forms must still be printed | Phase 3 | Heat lists, qualified lists, scores sheets and final results are built |

## Phase 3: Backend (built)

Summary:

- [x] 0. Backend package: Fastify, config, health endpoint, scripts
- [x] 1. Database: Drizzle schema, WAL, migrations and the sample-data seed
- [x] 2. Sign-in and roles: staff passwords, adjudicator PINs, httpOnly cookie
- [x] 3. Admin and secretariat endpoints
- [x] 4. Round control: the scrutineer starts rounds
- [x] 5. Marks: validation, safe resubmission, paper-sheet entry
- [x] 6. Scoring in the server: recalls, ties, approve, publish
- [x] 7. Real-time: Socket.IO, heartbeats, read-only room for public viewers
- [x] 8. Compere announcements from real approvals
- [x] 9. Audit log and backups
- [x] 10. Frontend switch from mocks to the API
- [x] 11. Printing with real data
- [x] 12. Testing: full competition, permissions, concurrency, crash
- [x] 13. Running on the server (deploy/README.md)

Open from Phase 3 (all since built): age group from birth year, the unbreakable-tie decision, the paper-marks screen, and enforcing paid entries when a round starts.

## Phase 4: Offline safety (removed: online only)

Built, then removed in commit `6d286f2`. It gave the venue laptop an offline copy of the app (PWA with HTTPS), backup drives with a takeover and `restore` command for a second laptop, and a rehearsal of those. BIS is now online only. What stayed because it also helps on mobile data: the phone saves marks first and resends them after a dropped connection, the scrutineer's board shows quiet phones and phones holding unsent marks, backups, and the paper fallback.

Offline mode comes back only if the client asks. It would involve a venue server on a laptop, change capture and sync with the cloud, an offline copy of the app, and takeover and restore tooling. All of it can be recovered from git history (`git show 6d286f2^:VENUE.md` for the old running guide).

## Phase 5: Cloud backend and sync (removed: online only)

Built, then removed in commit `6d286f2`: a cloud mode of the server, an upload queue (`outbox`), a download of a competition to the venue, a held-competition lock, sync status screens and the take-back screen. One server now does everything, so none of it is needed. What stayed: the Docker and Caddy hosting files, backups after every change and on an interval, and the optional daily offsite copy (`docker compose --profile offsite up -d`). See [deploy/README.md](../../deploy/README.md).

- [ ] Put the server on a real host (deploy/README.md)

## Phase 6: Registration and payments (changed)

Built as a team portal with online proof of payment and Messenger messages, then changed when the client said the secretariat registers every team. Removed: Messenger, and the old team portal that paid online with no secretariat check. Team accounts came back later in a smaller form (below). What exists now:

- [x] The secretariat enters teams, coaches and competitors from the entry forms, with the entry form's details, fees, deadlines and entry warnings.
- [x] Athlete accounts: an athlete signs up with an email and password, keeps their details and reports a membership payment; the secretariat confirms or turns it down.
- [x] Payments are a read-only ledger; the secretariat records how each was paid.
- [x] Coach and team accounts: they sign up, ask to be linked to their record and the secretariat approves it. Their pages match the athlete's: details, dancers, results, rankings, entries, payments, notifications and password.
- [x] Online entry: a team or an athlete sends an entry with a payment screenshot; the secretariat approves it into real entries and a payment, or turns it down with a reason. The sender is told, with a pop-up and a saved notification.
- [x] Real-time pop-up notifications with a chime for every role except the adjudicator and compere.
- [x] A competition has a required card photo, shown on the home page.
- [ ] Data Privacy Act of 2012: the privacy notice (`/privacy`) was rewritten for the entry form and athlete accounts. The organizer must confirm it. Retention is settled: details are kept permanently until removed.

## Program (running order) (built)

Goal: dancers, parents and the announcer can see what is on the floor, what is next and when everything starts, and the secretariat can print it.

- [x] The secretariat lays out the program: start time, rounds in order, breaks and the awarding; times work out from the start time and each line's minutes.
- [x] Public page with search and a round filter; Print and PDF carry the filter. PDF is the browser's Save as PDF from the print dialog, so no PDF library.
- [x] Compere screen: key 5 shows on the floor, up next and the three after.
- [ ] Set the real minutes per round with the client (CLIENT_QUESTIONS.md item 8); the starting guesses are in `backend/src/services/program.ts`.

## Sign-in security

Built:
- A PIN-guess limit across all visitors, and a per-account limit on wrong passwords.
- Six-digit adjudicator PINs, printed on PIN cards with a QR code that signs the phone in. The PIN is after a `#` in the QR address, so it is never sent to the server or logged.
- PINs that work only one day either side of the competition date (`ADJUDICATOR_PIN_DAYS`), an audit of PIN sign-ins, and one phone at a time per adjudicator: a new sign-in signs the old phone out.
- Sign out everywhere: an admin can end every session of a staff member, adjudicator or athlete. A reset password or a new PIN does the same.
- Two-step sign-in with an authenticator app (TOTP) for any staff account, with recovery codes; an admin can reset it for someone who lost their phone. It is optional, each person turns it on from the Security screen.
- A cap per address on calls that need no sign-in (`PUBLIC_RATE_LIMIT`, default 600 a minute).
- Security headers from Caddy (including an enforced Content-Security-Policy) and a Secure session cookie.

Not built: making two-step sign-in compulsory for admins (today it is each person's choice), and a way to see and end individual sessions (sign out everywhere ends all of them).

## Phase 7: Testing and pilot

Details in [PHASE7_README.md](PHASE7_README.md); the plan for the real event is [PILOT.md](../operations/PILOT.md).

- [x] A whole competition run through BIS end to end (the sample one; `backend/src/fullcompetition.test.ts`)
- [ ] The same with real sheets from a past competition, once the client provides them
- [x] Load test: 10 phones marking at once with 100 spectators reading (`pnpm loadtest`), no marks lost or doubled
- [ ] Rehearse against the real online server, with real phones on mobile data and real laptops: `pnpm loadtest`, `pnpm rehearsal` and the checks by hand
- [x] Tool to compare BIS with the paper result sheets (`results:compare`)
- [ ] Pilot at a real competition, with the current method running alongside, and compare every result
- [x] Training: a one-page guide per role in [guides/](../guides/)
- [ ] Rehearsal with the actual secretariat, scrutineer, chairperson and adjudicators, using the guides (and fix any step a guide gets wrong)
- [ ] Fix list from the pilot, then a second, smaller event before the system is relied on alone

## Carried over from earlier phases

- [ ] Add each real result sheet as a fixture in `packages/scoring/fixtures/`.
- [x] Rules 1, 2 and 5-11 checked against the text of the Skating System (the Austrian federation's copy of it) and three published WDSF finals. Still to check against WDSF's own Skating System file (on Box) and the 2026 rules.
- [ ] Confirm the shared-place ranking points rule (`pointsForRange` in `packages/scoring/src/points.ts`).
- [x] Shared place ranges are stored on results and shown as a range (such as 3rd–4th) on the final results printout, the public results and a dancer's history.
- [x] Chairperson decision flow for an unbreakable tie in a final: built (see below). The rule for settling it is the organizer's to confirm.
- [ ] Confirm the age-group limits in `packages/shared/src/ageGroup.ts` with the organizer.
