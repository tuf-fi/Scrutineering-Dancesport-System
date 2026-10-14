# Phase 7: Testing and Pilot

Goal: show that BIS is correct, fast enough and safe, then run it at a real competition beside the current method. See [PILOT.md](PILOT.md) for the plan to follow.

## Status: tools and tests built; the pilot itself is not done

| Item | Status |
| --- | --- |
| Run a whole competition through BIS end to end | Done on the sample competition (below). Not done on a real past competition: there are no real result sheets in the repository yet |
| Load test with 10 phones marking at once | Done: `pnpm loadtest` |
| Compare BIS with the paper sheets | Tool done: `results:compare` |
| One-page guide for each role | Done: [guides/](guides/) (adjudicator, scrutineer, chairperson, secretariat, admin, MC, club); written from the screens, not yet tried by the people who will use them |
| Pilot at a real competition | Plan written (PILOT.md); needs a competition, real phones and people |
| Messages to clubs | Messenger built (Phase 6 follow-up); untested against Facebook |

## What was verified

### A whole competition (`backend/src/fullcompetition.test.ts`)
Every event of the sample competition (89 rounds in all) is planned and run from first round to published result through the same functions the screens call: scrutineer starts the round, each event's panel marks from phones signed in with PINs, the scrutineer approves and publishes. Every adjudicator marks the same dancers in back-number order, which gives an answer known without the scoring engine: the finalists are the lowest back numbers, placed in back-number order. The test checks, for every round and every event:

- each event has a result, one winner, and no dancer placed twice;
- the winner is the lowest back number among those placed, and the top places are in back-number order;
- the winner always has ranking points, and there are never more points rows than results;
- every approval and publication is in the audit log;
- the database passes the foreign-key and integrity checks, and the public pages show every result.

This proves the flow and the bookkeeping. It does not prove the scoring rules match the WDSF rulebook on hard cases (ties, shared places); that still needs real result sheets as fixtures (see the open items in ROADMAP.md).

### Ten phones at once (`pnpm loadtest`, `rehearsal/loadtest.mjs`)
The real server in its own process on a spare database: ten adjudicators sign in with PINs, ask what to mark and send their marks at the same instant, then send the same marks again as a flaky phone would, for five rounds, while 100 simulated spectators read the public pages. It fails if any request fails, a mark is missing or stored twice, the database is not intact, or the 95th-percentile time is over 1 second (set `LOADTEST_P95_MS` to change it). On this development laptop, with the server and the test sharing one machine:

| Request | 50th percentile | 95th percentile |
| --- | --- | --- |
| Phone asks what to mark | 11 ms | 21 ms |
| Phone sends marks | 11 ms | 26 ms |
| Public page read | 107 ms | 165 ms |

No marks were lost or doubled. The venue laptop is a different machine, over Wi-Fi, so run it there too (`pnpm loadtest`; set `LOADTEST_READERS` to 0 for phones only).

### Comparing with the paper (`results:compare`)
`pnpm --filter @bis/backend results:compare <competition id> paper.csv` reads the paper placings as `event,place,back_number` lines and lists every dancer whose place differs, who is missing on either side, and any line it cannot read. It compares only the events the paper covers. Four tests cover it.

## What a person still has to do

1. Type the placings of one or more real past competitions, with their marks if the sheets show them, so scoring can be checked against real answers, not only against the invented one.
2. Run `pnpm rehearsal` and `pnpm loadtest` on the real laptops, and the by-hand rehearsal on the real phones.
3. Choose the pilot competition and follow PILOT.md.
4. Decide with the organizer when paper can stop.

## Not covered

- Real phones, real Wi-Fi, and a real crowded venue.
- The Messenger messages against Facebook's real service, which may need Meta's review of the app.
- Browsers other than Chrome (the rehearsal uses Chrome).
- A load test of the online server with many clubs registering at once.
