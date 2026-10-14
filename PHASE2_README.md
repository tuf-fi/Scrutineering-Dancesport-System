# Phase 2: Scoring Engine

Build `packages/scoring` (`@bis/scoring`): the Skating System as pure TypeScript with no UI and no database. Phase 3 and the scrutineer screens call it. See [BUILD_README.md](BUILD_README.md) for the overall plan and [ROLES_README.md](ROLES_README.md) for terms.

## Decisions

| Question | Decision |
| --- | --- |
| Real result sheets for testing | None available. Tests use hand-built fixtures (see Testing) and real sheets are collected at the Phase 7 pilot |
| X marks across several dances in early rounds | Follow WDSF: marks are totalled per competitor across the dances of the round |
| Ranking points for shared places | Follow WDSF. Confirm the exact rule against the current WDSF rulebook before coding step 5 |

Rules 1 and 5–11 were implemented from the Skating System guide at https://a2024.tanzsportverband.at/file-download/3800/the_skating_system.pdf and its worked tables are the test fixtures. Rules 9–11 follow the same guide; check all of them against the current WDSF rulebook.

The Skating System rules (Rules 1–11) are fixed, so the engine must follow the WDSF text exactly. Where a rule is ambiguous, write the interpretation in a short comment and add a test for it.

## Scope

- In: callback counting, single-dance and multi-dance finals, places for earlier rounds, ranking points, tests, and wiring the scrutineer screens to the engine.
- Out: backend, database, real-time, and any UI beyond swapping mock logic for engine calls.

## To-dos

### 0. Package setup
- [x] Create `packages/scoring` as `@bis/scoring`: strict TypeScript, Vitest, depends only on `@bis/shared`.
- [x] Add a real root `test` script (currently an echo error) that runs every package's tests.
- [x] Reuse `Mark`, `Round`, `Dance` and related types from `@bis/shared`. Add new shapes there, not in the package.

### 1. Callback counting (early rounds)
- [x] Total X marks per competitor across the dances of the round.
- [x] Sort, take the top N (the round's recall number), and recall them.
- [x] Flag a tie when the competitors at position N and N+1 have equal totals, and list everyone on the tie.
- [x] Leave the tie decision to the scrutineer and chairperson (recall more, or only those above the tie). The engine reports the tie and applies the decision.
- [x] Validate input: every adjudicator on the panel submitted, each marked exactly the recall number per dance, no competitor marked twice, and no unknown back numbers.

### 2. Skating System, single-dance final (Rules 5–8)
- [x] Place each position from 1st down by majority (more than half the adjudicators) at that place or higher; with no majority, move to the next column (Rule 8).
- [x] If several competitors have a majority, the one with more placings at that level wins. If still equal, the lower sum of those placings wins.
- [x] Equal count and sum: compare the next column for those competitors only, down to the last column; still equal, they share the average place (the MC reads the best place of the range).
- [x] Return the working (counts and sums per place) so the screen can show how each place was decided.
- [x] Validate: each adjudicator uses each place exactly once, and the number of placings equals the number of finalists.

### 3. Skating System, multi-dance final (Rules 9–11)
- [x] Place each dance with the single-dance rules.
- [x] Combine the dance places into overall places: lowest total of dance places wins (Rule 9).
- [x] Break equal totals with Rule 10 (most marks of the place or higher, then lower sum, one place at a time), then Rule 11 (all dances' marks as one dance). If Rule 11 cannot split them either, they share the average place and the chairperson decides.
- [x] Support 2- to 5-dance events.
- [x] Return the working per dance and overall.

### 4. Places for earlier rounds
- [x] Everyone cut in the same round shares one range just below those who went further (30 start, 24 / 18 / 12 / 6 recalled: 25th–30th, 19th–24th, 13th–18th, 7th–12th). The MC and results use the best place of the range (25).
- [x] X counts are kept for the printout but do not reorder the range. This replaces the earlier plan to order cut competitors by X total.
- [x] Validate that each round's recalled competitors are exactly the next round's competitors.

### 5. Ranking points
- [x] Look up points from the admin-editable points table by final place, including 7th in a 7-competitor final. The semi-final row goes only to competitors cut in the semi-final; earlier rounds earn 0.
- [x] Competitors sharing places split the points of every place they cover equally (a tie for 2nd and 3rd gets (8 + 6) / 2 = 7 each). **Not confirmed against WDSF**; `pointsForRange` in `points.ts` is the one place to change.
- [x] The engine takes the points table as an argument and never hardcodes values.

### 6. Testing
- [x] Unit tests for every rule, one test per rule branch (50 in `packages/scoring`).
- [x] Fixtures from the worked examples in the Skating System guide (Rules 1, 5, 6, 7, 8, 9, 10). Rule 11 and shared-place cases are hand-built, because the guide's Rule 11 tables did not extract cleanly.
- [x] [printed-result.jpg](printed-result.jpg) checked: it is only a "Qualified Solos for the final" list with no marks, so it is not a fixture.
- [x] Edge cases: tie at the recall cutoff, tie starting at the top, three-way ties, equal sums, 7-competitor final, solo final, even-sized panel, a couple winning the section without winning a dance.
- [x] Property tests: any valid marks give every finalist exactly one place, and the places add up (single dance and 2- to 5-dance finals).
- [x] `packages/scoring/fixtures/` is ready for real result sheets (format in its README).
- [ ] Add each real result sheet as a fixture when the client provides one (first at the Phase 7 pilot).

### 7. Wire up the screens
- [x] The mock recall table and Skating System table call `@bis/scoring` (`frontend/src/mocks/scrutinizing.ts`). Partial rounds use only the adjudicators who have submitted, so the live board shows a provisional result.
- [x] The sample finals in `mocks/data/progress.ts` are placed by `placeFinal`, cut competitors by `placeEliminated`, and ranking points by `rankingPoints`; no static sample order is left.
- [x] `SkatingTable`/`SkatingRow` in `@bis/shared` carry the working: column counts (single dance), dance places and deciding rule (multi-dance), shared place, and whether the table is complete.
- [x] Scrutineer Results screen shows dance places, the rule that decided each place, and a "Provisional" note until every adjudicator has submitted.
- [x] Access stays behind `frontend/src/api/`. Screens do not import the engine or mocks.
- [x] Mock finals now use the competitors who were actually marked (the old sample took the lowest back numbers, which did not match the marks).
- [x] Tests for the adapter: `frontend/src/mocks/scrutinizing.test.ts`.

## Status

All steps are done except adding real result sheets as fixtures. `packages/scoring` has 50 tests and the frontend has 167, all passing.

## Done when

- All rule branches have passing tests, and the worked WDSF examples produce the published places.
- The scrutineer screens show engine results with the working, with no static sample order left.
- A tie at the cutoff, a majority tie and a multi-dance final each run end to end in the demo.

## Risks

- **No real data yet.** The engine can be correct against the rules and still be wrong against how the client scores. Get real sheets at the first pilot and re-run them before trusting results.
- **Rulebook version.** WDSF updates its rules. Record the rulebook version used in the package README.
