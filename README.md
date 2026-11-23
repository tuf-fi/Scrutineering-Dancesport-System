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
