# Rehearsal

## `pnpm e2e` (also `pnpm rehearsal`): the whole competition, end to end

Builds the screens, starts the real server on a throwaway sample database, and drives a real Chrome (a phone-sized window for each adjudicator, a laptop-sized one for staff). It takes about six minutes and never touches real competition data. Chrome or Edge must be installed; set `CHROME_PATH` if it is not in the usual place.

| Steps | What it does |
| --- | --- |
| 1 | The server and public pages, public data, and that every role reaches only its own functions |
| 2 | Event E11 on the floor: adjudicators D to G mark round 2 on their phones, the server tally is checked against a recount of every X, the scrutineer approves and publishes, and the semi-final field must be the 12 recalled. The secretariat then records the event's unpaid payments |
| 3 to 4 | The semi-final and the final: all seven adjudicators mark on their phones (X marks, then placings with a drawn signature), the scrutineer starts, approves and publishes, and the final order and ranking points are checked against what the adjudicators placed |
| 5 | An athlete signs up, saves details, sends a membership payment, and the secretariat confirms it |
| 6 | A team enters a dancer in two events with a payment; the secretariat approves; the entries, the fee and the payment are checked |
| 10 | The secretariat adds a dancer and enters them in two events: the fee on screen must equal the server's quote and the recorded payment. Registrations the rules forbid are refused (the same event twice, a solo dancer in a couple event, no events, a taken back number) |
| 11 | A tie across the cut of a recall: the round cannot be approved until the scrutineer proposes and the chairperson confirms, and only the couples above the tie go through |
| 12 to 13, 15 | A tie in a final, for 1st and for 2nd: settled by a dance-off or tie-break (1st and 2nd, or 2nd and 3rd), and kept as a shared place (1st to 2nd, or 2nd to 3rd, the rest unaffected). The scrutineer cannot confirm their own decision |
| 14 | A bad connection and a restart: a phone that loses its connection while finalizing holds its marks and sends them once when it is back; a phone that finalizes while the server is stopped sends them by itself after the restart, stays signed in, and nothing is doubled. Sessions survive the restart |
| 7 | Every role's screens are crawled for console errors, failed calls, blank pages, `undefined` or `NaN` on screen, and sideways overflow |
| 8 to 9 | No browser console error or failed call during the run, and no error in the server log |

Set `E2E_SKIP_CRAWL=1` to skip step 7 (it is half the time). The exit code is non-zero if any step fails. A screenshot of the published final is saved in `rehearsal/shots/`.

The sample starts E11 on the floor with entries unpaid and a few payments left "for checking", which a real event cannot have. The script records the unpaid ones through the app and clears the "for checking" ones in the throwaway database, because nothing in the app can.

**What it does not cover:** real phones on mobile data, the real HTTPS address behind Caddy, iPhone Safari, a browser killed while it holds unsent marks, and and a tie among three or more couples. Run those by hand on the actual devices against the real server.

## `pnpm loadtest`

A separate check: ten phones marking at the same moment with a crowd reading the public pages. See [PHASE7_README.md](../PHASE7_README.md).
