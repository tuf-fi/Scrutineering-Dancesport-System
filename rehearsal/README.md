# Rehearsal

## `pnpm e2e`: the whole competition, end to end

Builds the screens, starts the real server on a throwaway sample database, and drives a real Chrome (a phone-sized window for each adjudicator, a laptop-sized one for staff). It takes about five minutes and never touches real competition data. Chrome or Edge must be installed; set `CHROME_PATH` if it is not in the usual place.

| Steps | What it does |
| --- | --- |
| 1 | The server and public pages, public data, and that every role reaches only its own functions |
| 2 | Event E11 on the floor: adjudicators D to G mark round 2 on their phones, the server tally is checked against a recount of every X, the scrutineer approves and publishes, and the semi-final field must be the 12 recalled. The secretariat then records the event's unpaid payments |
| 3 to 4 | The semi-final and the final: all seven adjudicators mark on their phones (X marks, then placings with a drawn signature), the scrutineer starts, approves and publishes, and the final order and ranking points are checked against what the adjudicators placed |
| 5 | An athlete signs up, saves details, sends a membership payment, and the secretariat confirms it |
| 6 | A team enters a dancer in two events with a payment; the secretariat approves; the entries, the 800 peso fee and the payment are checked |
| 7 | Every role's screens are crawled for console errors, failed calls, blank pages, `undefined` or `NaN` on screen, and sideways overflow |
| 8 to 9 | No browser console error or failed call during the run, and no error in the server log |

Set `E2E_SKIP_CRAWL=1` to skip step 7 (it is most of the time). The exit code is non-zero if any step fails. The screenshot of the published final is saved in `rehearsal/shots/`.

The sample starts E11 on the floor with entries unpaid and a few payments left "for checking", which a real event cannot have. Step 2 records the unpaid ones through the app and clears the "for checking" ones in the throwaway database, because nothing in the app can.

**What it does not cover:** real phones on mobile data, the real HTTPS address behind Caddy, iPhone Safari, a dropped connection or a stopped server in the middle of marking, and direct registration by the secretariat. Run those by hand on the actual devices against the real server.

## `pnpm rehearsal`: out of date

`rehearse.mjs` still looks for the old username field and the backup-folder checks of the offline version, so most of its steps fail. Use `pnpm e2e`. Its dropped-connection and server-restart steps (3 and 4 below) are the part worth porting to the new sign-in.

### What the old script checked

`pnpm rehearsal` checks what a bad connection or a failing backup folder does, for real, in a few minutes, on a spare sample database in a temporary folder. It never touches real competition data.

It starts the real server as a separate process and drives a real Chrome (a phone-sized window for each adjudicator, a laptop-sized one for the scrutineer). Chrome or Edge must be installed; set `CHROME_PATH` if it is not in the usual place.

| Step | What it does |
| --- | --- |
| 1 | The scrutineer signs in and sees the round on the floor; an adjudicator signs in with a PIN |
| 2 | A backup folder stops working and is fixed again; the scrutineer is told, then it clears, and the other folder keeps working |
| 3 | A phone loses its connection, confirms its marks, has its browser killed, reopens with a connection: the marks arrive once |
| 4 | The server is stopped while a phone confirms, then restarted: the phone sends by itself |

Screenshots of the screens it visits are saved in `rehearsal/shots/`. The exit code is non-zero if any step fails.

**What it does not cover:** real phones on mobile data, the real HTTPS address behind Caddy, and iPhone Safari. Run the same checks by hand on the actual devices against the real server as well.

`pnpm loadtest` is a separate check: ten phones marking at the same moment with a crowd reading the public pages. See [PHASE7_README.md](../PHASE7_README.md).
