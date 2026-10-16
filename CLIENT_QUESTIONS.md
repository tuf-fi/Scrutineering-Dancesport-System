# Questions for the Client / Organizer

Decisions and materials BIS needs from the organizer before it can be relied on. Each answer should be recorded here or in the file named in "Where it lives". Deployment tasks are in [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md).

| # | Question | Why we need it | Where it lives | Answer |
| --- | --- | --- | --- | --- |
| 1 | Real result sheets with **every adjudicator's marks**, from past competitions | The scoring engine is only checked against the Skating System guide's examples. These become test fixtures and the pilot comparison. | `packages/scoring/fixtures/` | |
| 2 | Is the **points table** approved? | The table in the app is only a suggestion. | Points screen (admin) | |
| 3 | When places are shared, how are **ranking points** split? | The app splits the points of the shared places equally. This is not confirmed against WDSF. | `pointsForRange` in `packages/scoring/src/points.ts` | |
| 4 | How is an **unbreakable tie in a final** settled? | Built so the chairperson confirms either keeping the shared place or a tie-break order typed in by the scrutineer. The organizer must confirm this is their rule. | Scrutineer results screen | |
| 5 | **GCash, Maya and bank account details** for entry fees | Shown to clubs when they register. | Fees and payment details screen (admin) | |
| 6 | **Age-group limits** | Age group is worked out from the year of birth. The limits must match the organizer's rules. | `packages/shared/src/ageGroup.ts` | |
| 7 | Which **WDSF rulebook version** applies? | Rules 1 and 5-11 in the scoring engine need confirming against it, and the version recorded. | `packages/scoring` | |
| 8 | Which **paper forms** must still be printed? | Heat lists, qualified lists, scores sheets and final results are built. Anything else needs to be added. | Print screens | |
| 9 | Access to the **Facebook Page** used for Messenger messages | Payment approved/rejected messages to clubs. Needs testing with the real Page and may need Meta app review. | [deploy/README.md](deploy/README.md) | |
| 10 | Where can **online backups be copied** each day? | The offsite copy needs a destination. | `docker compose --profile offsite` | |
| 11 | A **real competition** for the pilot, plus a smaller second event | BIS runs alongside the current method and every result is compared. | [PILOT.md](PILOT.md) | |
| 12 | Time with the **secretariat, scrutineer, chairperson and adjudicators** | A rehearsal using the one-page guides, to fix any step that is wrong. | [guides/](guides/) | |
| 13 | Real **phones and laptops** at the venue (or equivalents) for the rehearsal | The by-hand rehearsal and load test have only run on the dev machine. | [VENUE.md](VENUE.md) | |

## Notes

- Items 1-8 affect whether results are correct. Get these first.
- Item 9 can take weeks if Meta review is needed. Ask early.
- Items 11-13 are scheduling, not decisions, but they gate the pilot.
