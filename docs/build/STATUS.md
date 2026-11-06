# BIS Status

Where the system stands on 3 November 2026, what is left, and what is still unclear. [ROADMAP.md](ROADMAP.md) has the phase history; [CLIENT_QUESTIONS.md](../client/CLIENT_QUESTIONS.md) has the questions as sent to the client, and [CLIENT_DOCUMENTS.md](../client/CLIENT_DOCUMENTS.md) has what the client sent back.

## What is built

- Scoring engine (`packages/scoring`): the Skating System, checked against the organizer's sheets and three published WDSF finals, including Rule 10 and Rule 11 ties (`packages/scoring/fixtures/`).
- Server and screens for every role: admin, secretariat, scrutineer, chairperson, compere, adjudicator (phone, with drawn signature) and public.
- The secretariat registers teams from the entry forms: teams, coaches, competitors, fees, deadlines and entry warnings.
- Athlete accounts: an athlete signs up with an email and password, keeps their details and reports a membership payment; the secretariat confirms it.
- The program (running order) with minutes from the WDSF rules.
- Coach and team accounts: they sign up, ask to be linked to their record (the secretariat approves), and get pages like the athlete's.
- Online entry: a team or an athlete sends an entry with a payment screenshot; the secretariat approves it into real entries and a payment, or turns it down with a reason.
- Pop-up notifications with a chime in real time for every role except the adjudicator and compere.
- A phone and tablet pass over the whole app: black header with a right-hand menu for staff and the public site, a fixed account strip on the athlete, coach and team pages, filters in one row with buttons below, larger text on phones, skeleton loading everywhere, scroll to the top on every page change, and smooth drawers, dialogs and hovers. See [DESIGN.md](../../DESIGN.md).
- A required card photo on every competition, shown on the home page.

## What is left

| Item | Kind |
| --- | --- |
| Put the server on a real host ([deploy/PRODUCTION.md](../../deploy/PRODUCTION.md); staging first: [deploy/STAGING.md](../../deploy/STAGING.md)) | Deployment |
| Rehearse with real phones on mobile data and real laptops (`pnpm loadtest`, `pnpm rehearsal`) | Testing |
| Rehearse with the actual secretariat, scrutineer, chairperson and adjudicators, using the guides in [guides/](../guides/) | Testing |
| Pilot at a real competition beside the current method; compare every result ([PILOT.md](../operations/PILOT.md)) | Testing |
| Fix list from the pilot, then a second, smaller event | Testing |
| Rehearse the offline venue laptop (branch `offline-mode`, [docs/operations/OFFLINE_MODE.md](../operations/OFFLINE_MODE.md)) on a real laptop, router and phones, and decide whether to merge it | Testing |
| Open the athlete, coach and team flows, and every screen at phone and tablet width, in a real browser and on a real iPhone (only tests and the code have been checked) | Check |
| Give the sample competitions a card photo, or have the admin add one on each; until then they show the shared dance photo and cannot be edited without one | Setup |
| Organizer reads the privacy notice (`/privacy`) and confirms it. Entry form details are kept permanently until removed; nothing is deleted automatically | Organizer |
| Add each real result sheet as a fixture in `packages/scoring/fixtures/`, and run a whole competition from real past sheets through BIS | Testing |
| Confirm the scoring engine's Rules 1 and 5-11 against the current WDSF rulebook and record the version used; confirm the shared-place ranking points rule (`pointsForRange` in `packages/scoring/src/points.ts`) and the age-group limits (`packages/shared/src/ageGroup.ts`) | Client |
| Store shared place ranges on results, so printouts can show a tie and not only its best place | Optional |
| Check the `TODO` markers before deploying: `backend/src/db/schema.ts`, `frontend/src/features/print/PrintSheet.tsx`, `packages/scoring/src/points.ts`, `packages/shared/src/ageGroup.ts` | Check |
| Make two-step sign-in compulsory for admins, and a way to end one session at a time | Optional |

## What is still unclear

| Question | Who answers | Blocks |
| --- | --- | --- |
| Is the Skating System BIS was checked against the same as WDSF's current file? Rules 9 to 11 also match the Austrian federation's German translation of the WDSF Skating System (2001 edition, marked "Fassung: WDSF"); the current English file on WDSF's site redirects to Box and could not be read. | Anyone who can open WDSF's Skating System on Box | Low risk |

## Settled

- No messaging to teams: the secretariat does it. A team or athlete is told what the secretariat decided on an entry through a notification on their page.
- The secretariat registers teams; athletes make their own account and pay their own membership, and nothing more: the PDF says the athlete profile is where athletes register their membership fee. The secretariat enters every event from the entry forms.
- A tie for 1st goes to the chairperson, usually a dance-off; other places are shared (2½). The chairperson has the final say. This is also what the Skating System text says after Rule 11 ("there is no Rule 12").
- Rules 1, 2, 5-11 were read in the Skating System text and match the engine: majority, equal-majority sums, then the next column for those couples only, averaged shared places announced at the best place; Rule 10 counts a fraction as the next whole place and sums it at face value; Rule 11 places one couple at a time and the rest go back to Rule 10; a tied recall is the chairperson's decision.
- Age groups come from the 2026 entry forms; ages by birth year.
- Age groups: Juvenile to Youth from the 2026 entry forms; Adult 19-34 and Senior 35+ from WDSF 2018 E.2, by birth year. Senior I-IV, Under 21 and the younger partner's minimum age are not modelled, as the forms stop at Youth.
- Finals have 6 couples, as in the client's PDF ("select 6"): an event with 7 or more entries gets a semi-final that recalls 6, so there is no 7th place. WDSF 2018 rule 8.2.10 also says a final should have no more than 6 couples.
- Fees, payments and the program stay in BIS, although the client said the system focuses on scrutineering, athletes, coaches and adjudicators' records. Athletes do not yet see their entries, fees or the program on their own page.
- The client sets the entry and fee deadlines (the forms say Nov 9 and Nov 20); the admin enters them on the competition as **Entries close** and **Fees due**, and until then there are no deadline warnings.
- Closed events (such as Closed Camarines Sur) are open to one province: the secretariat sets the event kind to Closed and enters the province, and BIS refuses a team whose entry form province is different.
- A selection round is exactly 6 marks per adjudicator ("Select 6"). The client's 12-to-6 sample sheet has adjudicators marking 7 or 8; it is treated as a typing error in the sample. Skating System Rule 1: a judge "must only mark as many couples as the Chairman requests"; a sheet with an error goes back to the judge via the Chairman.
- The BGB Juvenile dance order on the solo form (`S C J W T Q`, `PD R F VW`) is the same ten single dances as the other events in a different box order, so there is nothing to enforce. Each ticked dance is its own event, and a Grade C event is a Latin set and a Standard set.
- Soloists dance together in heats, so a solo event is timed like any other: up to 2 minutes a dance, up to 10 in a heat, one minute per heat to change over (WDSF 2018 E.3.1 and 8.2.5). The secretariat can still edit each line.
- Ranking points on a shared place follow the Skating System: tied couples share the average of their places (2nd and 3rd are both 2½) and get the average of those places' points (180 and 160 give 170 each). The PDF shares the place and prizes but is silent on points.
- Fees are as written in rules 3 to 5 of the entry forms: the first entry at the tier's price, every entry after it at the additional price, Inter-Collegiate and Ranking events at a flat 1,000, and membership (athlete 500, coach 1,000) and the Coaches Summit (1,000) per person. There is no separate team fee, as the forms list none. The admin can change any amount.
- The Skating System is the judging system for Standard and Latin finals.
- Paper forms: the adjudicator sheet and the summary of score sheet.
