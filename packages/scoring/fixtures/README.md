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
