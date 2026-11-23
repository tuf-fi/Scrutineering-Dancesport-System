# img-and-docs (branch)

Images and PDFs taken out of `main` to keep it light. This branch holds only these files; it shares no history with `main`. Check it out with `git switch img-and-docs`.

| Folder | Holds |
| --- | --- |
| `screenshots/<role>/` | Every screen of each role and account kind, at MacBook 12" and iPhone 15, on realistic scenario data (Bicol Grand Prix 2026) |
| `docs/manual/` | The user manual: `manual.html`, its build script, the PDF and the images it uses |
| `docs/client/` | PDFs sent to the client |
| `docs/guides/` | The compere guide PDF |
| `docs/operations/` | Operations PDFs (go-live, offline day, dry-run fixes) with the HTML and scripts that build them |
| `printed-result.jpg` | A sample printed result sheet |

Each file is named `NN-page-device.png` (a page, from `rehearsal/role-shots.mjs`) or `Fnn-feature-device.png` (a feature being used, from `rehearsal/feature-shots.mjs`: forms filled in, confirmations, approvals, the adjudicator marking a final). The device is `macbook-12` (MacBook 12", 1280x800) or `iphone-15` (393x852).

## Not screenshotted, and why

- **Tie decisions.** Two kinds of tie can stop a round from being approved, and neither is shown here:
  - *A tie at the recall cut-off* (for example two couples level for the last place into the next round). The scrutineer chooses how to settle it and presses **Propose decision** on the Recall page. The chairperson then presses **Confirm tie decision**. The round cannot be approved until both have acted.
  - *A tie in a final.* The scrutineer proposes either keeping the shared place (for example 2nd to 3rd) or a tie-break order, on the Results page. The chairperson confirms it there.
  - The scrutineer can never confirm their own proposal, and every decision is stored with the person's name and the time.
- **Membership payment.** Teams pay the membership fee, so the athlete's Membership page only shows the fee and who pays. It is captured as a page, not a form.
- **Adjudicator waiting screen** and the **syllabus box** on the adjudicator's marking page (the app shows placeholder text there until the organizer's syllabus is added).
