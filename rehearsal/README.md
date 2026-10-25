# Rehearsal

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
