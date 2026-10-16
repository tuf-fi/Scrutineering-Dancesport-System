# Questions for the Client / Organizer

Decisions and materials BIS needs from the organizer before it can be relied on. Each answer should be recorded here or in the file named in "Where it lives". Deployment tasks are in [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md).

| # | Question | Why I need it | Where it lives | Answer |
| --- | --- | --- | --- | --- |
| 1 | Can you give me **result sheets from past competitions**, showing the marks of every adjudicator? | I want to check that BIS gives the same results as your paper sheets. So far I have only tested it with examples from a guidebook. | `packages/scoring/fixtures/` | |
| 2 | If a final ends in a **tie that cannot be broken**, what do you do? | BIS lets the chairperson choose: keep the shared place, or use an order typed in by the scrutineer. Please confirm this is how you do it. | Scrutineer results screen | |
| 3 | What are the **age group limits**? | BIS works out a dancer's age group from their birth year. The limits must match your rules. | `packages/shared/src/ageGroup.ts` | |
| 4 | Which **WDSF rulebook** (and which year) do you follow? | I need to check BIS's scoring against the same rulebook you use. | `packages/scoring` | |
| 5 | Which **paper forms** do you still need printed? | BIS already prints heat lists, qualified lists, score sheets and final results. Tell me if you need anything else. | Print screens | |
| 6 | How should I message teams: through your **Facebook Page**, by **SMS**, or both? | BIS can message a team when their payment is approved or rejected. Facebook is ready to use, but I need to test it with your real Page, and Facebook may need to approve it first, which can take weeks, so please tell me early. SMS is not built yet and the mobile network charges for each message. Tell me if you want it. | [deploy/README.md](deploy/README.md) | |
| 7 | How should **teams register** for a competition? Should each team have an **account**, or do you prefer another way? | Right now each team makes its own account with a password, adds its dancers, chooses the events and sends proof of payment for you to check. Tell me if you want this, or if you prefer something else, such as the secretariat entering the teams, or a simple form with no account. Tell me how teams register today and any suggestions. | Online registration | |

## Notes

- Items 1-5 affect whether results are correct. Get these first.
- Item 6 can take weeks if Meta review is needed. Ask early.
