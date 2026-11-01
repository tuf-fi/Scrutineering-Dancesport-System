# Real result fixtures

Add each real result sheet here as `<competition>-<event>.json` once the client provides it, then add a test in `src/fixtures.test.ts` that feeds the marks to `@bis/scoring` and expects the published places.

Shape:

```json
{
  "source": "Where the sheet came from",
  "adjudicators": ["A", "B", "C"],
  "dances": [{ "dance": "waltz", "marks": { "<back number>": [1, 2, 1] } }],
  "expectedPlaces": { "<back number>": 1 }
}
```

Marks are listed in adjudicator order. Shared places are the average, e.g. `1.5`.

The tests in `src/fixtures.test.ts` read these files. `bicol-single-dance-final.json` is a 7-adjudicator final from the organizer. `bicol-selection-12-to-6.json` is their 12-to-6 selection sheet: its totals add up to 51 X marks where 7 adjudicators selecting 6 would give 42, so it is checked for totals only. Ask for a sheet where everyone marked 6.

The `wdsf-*.json` files are final reports published by WDSF (the source URL is in each file): every adjudicator's placing per dance and the published places. They cover a tie split by Rule 10 (Berlin 2014, Burgas 2025) and by Rule 11 (Yerevan 2021). Add `expectedDancePlaces` (one place per dance, in file order) and `decidedBy` (the rule that placed a couple) to check those too. The pages' unlabelled count columns were not used, and the Berlin and Burgas Rule 10 tables are not explained on the page, so only the final places are checked.
