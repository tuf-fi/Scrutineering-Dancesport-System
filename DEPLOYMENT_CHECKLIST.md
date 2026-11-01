# Deployment Checklist

What is left before BIS is relied on at a real competition. The features are built through Phase 7's tooling; what remains is checking on real hardware and with real people. Source of truth: [ROADMAP.md](ROADMAP.md). Questions for the client are in [CLIENT_QUESTIONS.md](CLIENT_QUESTIONS.md).

## Blockers

- [ ] **Deploy the server.** Put it on a real host. It has only run on the dev machine. Steps: [deploy/README.md](deploy/README.md).
- [ ] **Rehearse against the real server.**
  - [ ] By hand with real phones on mobile data and real laptops: PIN sign-in, marking, a dropped connection, a phone switched off mid-round.
  - [ ] Run `pnpm loadtest` and `pnpm rehearsal`, and open the site in a browser to check the Content-Security-Policy report-only console before enforcing it.
- [x] ~~Try Messenger with the real Facebook Page.~~ Not needed: the organizer's secretariat messages the teams, so BIS does not. The Messenger code was removed.
- [ ] **Rehearse with the real staff.** Secretariat, scrutineer, chairperson and adjudicators, using the guides in [guides/](guides/). Fix any step a guide gets wrong.
- [ ] **Pilot at a real competition.** Run BIS alongside the current method and compare every result (`results:compare`). Plan: [PILOT.md](PILOT.md).
- [ ] **Fix list from the pilot, then a second, smaller event** before the system is relied on alone.

## Scoring checks (need client input)

- [ ] Add each real result sheet as a fixture in `packages/scoring/fixtures/`.
- [ ] Run a whole competition from real past sheets through BIS.
- [ ] Confirm the scoring engine's Rules 1 and 5-11 against the current WDSF rulebook and record the version used.
- [ ] Confirm the shared-place ranking points rule (`pointsForRange` in `packages/scoring/src/points.ts`).
- [ ] Confirm the age-group limits in `packages/shared/src/ageGroup.ts`.

## Smaller open items

- [ ] Store shared place ranges on results, so printouts can show a tie and not only its best place.
- [ ] Check the `TODO` markers before deploying:
  - `backend/src/db/schema.ts`
  - `frontend/src/features/print/PrintSheet.tsx`
  - `packages/scoring/src/points.ts`
  - `packages/shared/src/ageGroup.ts`

## Before you deploy

- [ ] Review the uncommitted working tree (36 changes at the time of writing, including the removed `XBoard` and `PaperMarksPage` and the new `XTable`, `GoToFloor` and `PaymentMethodDialog`).
- [ ] Run the tests and typecheck.
- [ ] Commit in small, one-feature commits.
