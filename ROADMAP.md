# BIS Roadmap

Where the build stands and what is left. Details for each phase are in the linked file. Architecture and the reasons for each choice are in [BUILD_README.md](BUILD_README.md).

## Status

| Phase | What | Status | Details |
| --- | --- | --- | --- |
| 1 | Screens with sample data | Done | [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md), [WALKTHROUGH.md](WALKTHROUGH.md) |
| 2 | Scoring engine | Done, except real result sheets as fixtures | [PHASE2_README.md](PHASE2_README.md) |
| 3 | Venue backend | Built; four items open | [PHASE3_README.md](PHASE3_README.md), [VENUE.md](VENUE.md) |
| 4 | Offline safety | Not started | below |
| 5 | Cloud backend and sync | Not started | below |
| 6 | Registration and payments | Not started | below |
| 7 | Testing and pilot | Not started | below |

## Decisions still needed from the client

| Item | Needed by | Why |
| --- | --- | --- |
| Real result sheets with every adjudicator's marks | Phase 3 testing | The scoring engine is only checked against the Skating System guide's examples |
| Approved points table | Phase 3 | The table in the app is a suggestion |
| Rule for ranking points when places are shared | Phase 3 | The app splits the points of the shared places equally; not confirmed against WDSF |
| Who decides an unbreakable tie in a final, and how | Phase 3 | The guide says the chairperson; the screens need the exact flow |
| GCash, Maya and bank account details for entry fees | Phase 6 | Shown to clubs when they register |
| Which paper forms must still be printed | Phase 3 | Heat lists, qualified lists, scores sheets and final results are built |

## Phase 3: Venue backend (built)

Full list in [PHASE3_README.md](PHASE3_README.md). Summary:

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

Open from Phase 3: age group from birth date, the unbreakable-tie decision, the paper-marks screen (Phase 4), and enforcing paid entries when a round starts.

## Phase 4: Offline safety

Goal: nothing is lost when Wi-Fi drops, a phone dies or a refresh happens mid-round.

- [ ] Make the web app a PWA (`vite-plugin-pwa`) so it opens with no connection.
- [ ] Adjudicator marks are saved on the phone first, then sent. Keep them in IndexedDB so a refresh cannot lose them (the current outbox in `frontend/src/stores/outbox.ts` is in memory).
- [ ] Resend automatically after a Wi-Fi drop. The server accepts a repeated submission as a repeat.
- [ ] The scrutineer's live board shows any phone that has gone quiet, and which marks are still waiting on a phone.
- [ ] Paper fallback: printable blank mark sheets, and a scrutineer screen to type in an adjudicator's marks. The server endpoint is built in Phase 3.
- [ ] Backup device: Laptop 3 can take over as the server if Laptop 2 fails. Write and rehearse the steps.
- [ ] Test by switching the Wi-Fi off and on during a round, killing a phone's browser, and restarting the server.

## Phase 5: Cloud backend and sync

Goal: the same server runs online, and venue and cloud stay in step.

- [ ] Deploy the server in cloud mode with PostgreSQL. The schema is the same Drizzle definition.
- [ ] Upload queue: approved results, ranking points, entries and scratches go into the `outbox` table on the venue server and are sent when internet is available. Safe to repeat.
- [ ] Download before an event: the secretariat pulls the confirmed, paid entry list and the current rankings to the venue server.
- [ ] Public pages read from the cloud: latest results, past competitions, couple and solo profiles, rankings per category.
- [ ] Conflict rules: what wins when the same record changed at the venue and in the cloud (late entries, scratches, back numbers).
- [ ] Show sync status at the venue ("3 results waiting to upload") and on the admin screen.
- [ ] Hosting: a small VPS, HTTPS, automatic backups of PostgreSQL.

## Phase 6: Registration and payments (cloud)

Goal: clubs register and pay before the event, and the admin confirms payments by hand. BIS never handles card details or money. Flow and statuses are in [BUILD_README.md](BUILD_README.md#payment-system-checked-manually-by-the-admin).

- [ ] Club accounts: sign up, sign in, manage dancers.
- [ ] Register dancers to events, see the total fee, see payment details.
- [ ] Upload proof of payment (screenshot and reference number), stored privately and visible only to admins.
- [ ] Admin payment checking: approve, or reject with a reason; every decision is logged with name and time.
- [ ] Only approved or paid-at-venue entries can dance, unless the admin allows an exception.
- [ ] Data Privacy Act of 2012: collect only what is needed, because many dancers are minors; retention and deletion rules.
- [ ] Emails or messages to clubs when a payment is approved or rejected (decide the channel first).
- [ ] Remove the fake club passwords and payment stubs left from Phase 3.

## Phase 7: Testing and pilot

- [ ] Re-run a past competition through BIS end to end, with real sheets once the client provides them.
- [ ] Load test: 10 phones marking at once on the venue Wi-Fi, plus spectators on the guest network.
- [ ] Pilot at a real competition, with the current method running alongside, and compare every result.
- [ ] Training: a one-page guide per role and a rehearsal with the actual secretariat, scrutineer, chairperson and adjudicators.
- [ ] Fix list from the pilot, then a second, smaller event before the system is relied on alone.

## Carried over from earlier phases

- [ ] Add each real result sheet as a fixture in `packages/scoring/fixtures/`.
- [ ] Confirm the scoring engine's Rules 1 and 5-11 against the current WDSF rulebook and record the version used.
- [ ] Confirm the shared-place ranking points rule (`pointsForRange` in `packages/scoring/src/points.ts`).
- [ ] Store shared place ranges on results so printouts can show a tie, not only its best place.
- [ ] Chairperson decision flow for an unbreakable tie in a final.
