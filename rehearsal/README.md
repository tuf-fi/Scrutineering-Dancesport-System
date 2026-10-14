# Rehearsal

`pnpm rehearsal` runs the checklist in [VENUE.md](../VENUE.md) for real, in a few minutes, on a spare sample database in a temporary folder. It never touches real competition data.

It starts the real server as separate processes and drives a real Chrome (a phone-sized window for each adjudicator, a laptop-sized one for the scrutineer). Chrome or Edge must be installed; set `CHROME_PATH` if it is not in the usual place.

| Step | What it does |
| --- | --- |
| 1 | The scrutineer signs in and sees the round on the floor; an adjudicator signs in with a PIN |
| 2 | The backup drive is pulled out and plugged back in; the scrutineer is told, then it clears |
| 3 | A phone loses the Wi-Fi, confirms its marks, has its browser killed, reopens on the Wi-Fi: the marks arrive once |
| 4 | The server is stopped while a phone confirms, then restarted: the phone sends by itself |
| 5 | The scrutineer types in a paper sheet |
| 6 | Laptop 2 dies; Laptop 3 restores the newest backup, then (worst case) the oldest; phones stay signed in and put back marks the server lost |
| 7 | The offline copy of the app on localhost, on a plain `http://<address>` (not available, as documented), and over HTTPS |

Screenshots of the screens it visits are saved in `rehearsal/shots/`. The exit code is non-zero if any step fails.

**What it does not cover:** real phones, a real Wi-Fi network, a certificate trusted by a phone (it uses Chrome's certificate-error flag instead), and iPhone Safari. Run the checklist by hand on the actual devices as well.
