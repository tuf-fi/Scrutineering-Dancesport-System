# Client walkthrough (Phase 1 preview)

This walkthrough runs the app on sample data (`pnpm dev:sample`). Nothing is saved anywhere: changes live in the browser tab and reset on refresh, and sign-in is a stand-in. The real server, with accounts and a database, is described in [VENUE.md](VENUE.md).

## Run it

```
pnpm install
pnpm dev:sample
```

Open the address it prints. To share a static preview, run `pnpm build:sample` (the app on sample data, no server needed) and upload `frontend/dist` to Vercel or Netlify. Both configs are in `frontend/` (`vercel.json`, `public/_redirects`) so refreshing any page works.

## Sign in

| Who | Where | Sign in with |
| --- | --- | --- |
| Admin | `/login` | `admin` / `bis2026` |
| Secretariat | `/login` | `secretariat` / `bis2026` |
| Scrutineer | `/login` | `scrutineer` / `bis2026` |
| Chairperson | `/login` | `chairperson` / `bis2026` |
| MC / venue screen | `/login` | `mc` / `bis2026` |
| Adjudicator | `/adjudicator` | PIN `4100` (A), `4211` (B), `4322` (C), `4433` (D), `4544` (E), `4655` (F), `4766` (G) |
| Club | `/club/sign-in` | `club1@example.com` to `club8@example.com` / `bis2026`, or register a new club |
| Public | `/` | no sign-in |

In development, `Ctrl+Shift+D` opens a role switcher.

## The flow to show, in the order a competition runs

1. **Admin.** Competitions, staff accounts, adjudicators and PINs, panels per event, the points table, and payment checking (approve, or reject with a reason).
2. **Club.** Register a club, add dancers (name and age group only), tick events for each dancer with a running fee total, then pay: GCash, Maya or bank details, a receipt screenshot, the reference number and the amount.
3. **Admin again.** The new payment is in the queue as "For checking". Approve it or reject it, and see the club's payment page change.
4. **Secretariat.** Events (add, edit, delete), event entries and scratching, competitors and back numbers (assign, import a CSV), late entries and cash payments, the schedule, and the printouts.
5. **Adjudicator (phone).** Sign in with a PIN. The marking screen opens by itself when a round is on the floor: tap back numbers for an X, or place finalists. Use the demo controls at the bottom of the waiting screen to try a final and a three-dance round. Switch the Online dot to Offline to see marks saved and sent later.
6. **Scrutineer and chairperson.** Rounds, heats, the live board (updates as adjudicators submit), the recall table with the cutoff and the tie decision (the scrutineer proposes, the chairperson confirms), results, then approve and publish.
7. **MC screen.** Press the number keys 1 to 4 or the arrow keys to step through the next event, the recalled numbers, the finalists and the results from last place up. Press F for full screen.
8. **Printouts.** From an event, "All printouts": heat list, qualified list, scores sheet, final results with signature lines, and blank mark sheets. Use the browser's Print, or save as PDF.
9. **Public site.** Home with what is on the floor and the latest results, competitions, results per event, competitor profiles and rankings.

## What is stubbed

- The Skating System places are a sample order (lowest total). The real calculation is Phase 2.
- Back end, real accounts, real payments and the venue socket are Phase 3. Each stub in the code carries a `TODO`.

## Questions to ask the client

- Is the points table right?
- Is "Executor" on the printed sheets the organizer, or the scrutineer's team?
- Do the printed sheets match what you use today?
- Are the age groups, classes and dances complete?
- What should a club be allowed to change after its payment is approved?
- What GCash, Maya and bank details should clubs see?
