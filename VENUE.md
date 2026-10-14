# Running BIS at the venue

How to set up and run the BIS server on Laptop 2, connect everyone's devices, and recover if something fails. See [FLOW_README.md](FLOW_README.md) for how a competition runs and [BUILD_README.md](BUILD_README.md) for the architecture.

## What runs where

| Device | Does | Opens |
| --- | --- | --- |
| Laptop 2 (scrutineer) | Runs the BIS server and the database | `http://localhost:4000` |
| Laptop 1 (secretariat), Laptop 3 (MC / backup) | Browser only | `http://<Laptop 2 address>:4000` |
| Adjudicators' phones | Browser only | the same address |
| Spectators' phones (guest network) | Browser only; results and rankings | the same address |

One program serves the screens and the data, so nothing else needs installing on the other devices.

## First-time setup on Laptop 2 (needs the internet once)

1. Install [Node.js 24](https://nodejs.org) and pnpm 10 (`npm install -g pnpm@10`).
2. In the project folder: `pnpm install`.
3. Copy `backend/.env.example` to `backend/.env` and set:
   - `COOKIE_SECRET` is optional. Left out, the server makes a random one beside the database on first start and keeps it, so everyone stays signed in if the server is restarted.
   - `BACKUP_DIRS`: where copies of the database go, separated by commas. Use the USB drive and a shared folder on Laptop 3, for example `E:\bis-backups,\\LAPTOP3\bis-backups`.
4. Create the first admin: `pnpm --filter @bis/backend admin:create admin "Your Name"`. It prints a password; the admin changes it from the Staff screen. (An empty database has no accounts, so this step is needed once.)
5. Allow other devices through the Windows firewall, once, in an administrator PowerShell: `netsh advfirewall firewall add rule name="BIS" dir=in action=allow protocol=TCP localport=4000`.

To try BIS with the sample competition instead of real data, run `pnpm seed` on an empty database. Every sample account uses the password `bis2026`, so never seed a database you will use for a real competition.

## Starting it

```
pnpm venue
```

This builds the screens and starts the server on port 4000. It prints the address it is listening on. Leave the window open; closing it stops the competition.

Find Laptop 2's address with `ipconfig` (the IPv4 address on the venue Wi-Fi, for example `192.168.1.10`). Everyone opens `http://192.168.1.10:4000`. Give Laptop 2 a fixed address in the router so it never changes during the day.

Check it is running: open `http://localhost:4000/api/health`. It shows `"status":"ok"`.

## The Wi-Fi

| Network | Who joins | Notes |
| --- | --- | --- |
| Staff (password) | the three laptops, adjudicators' phones | no internet needed |
| Guest (optional) | spectators | Only Laptop 2's port 4000 should be reachable from it. Set this in the router (client isolation, and a rule allowing the guest network to `192.168.1.10:4000` only). BIS itself shows guests only published results and rankings, but the router is what keeps them away from the staff laptops |

## Before the first round

Tick these on the day, in order. The server shows the first two on screen.

- [ ] `api/health` says `ok`.
- [ ] The scrutineer's screen shows no "backup folder cannot be reached" notice. If it does, plug the drive in or fix the shared folder.
- [ ] Admin: the competition exists, the points table is approved, adjudicators and their PINs are made, and each event has a panel.
- [ ] Secretariat: entries are in (clubs registered online, or imported), back numbers are assigned, late entries are added.
- [ ] Scrutineer: **Plan rounds** on the Rounds screen creates the rounds for every event.
- [ ] Each adjudicator signs in on their phone with their PIN and sees "Online".
- [ ] Blank paper sheets for each event are printed and in the scrutineer's folder (Paper marks screen, "Print blank sheets").
- [ ] Laptop 3 has been set up and the takeover rehearsed (see below).
- [ ] The MC screen on Laptop 3 shows the announcements.

## Running a round

1. Scrutineer: **Start** on the round in the Rounds screen. The round appears on the adjudicators' phones.
2. Adjudicators mark and submit. The live board shows each phone as waiting, marking or submitted, and flags a phone that has gone quiet for more than 20 seconds.
3. When all have submitted, the scrutineer opens Recall (early rounds) or Results (final). A tie at the recall cutoff is proposed by the scrutineer and confirmed by the chairperson.
4. Scrutineer: **Approve**, then **Publish**. Approving saves the result, the ranking points and a backup of the database. Publishing makes the result public and sends it to the MC.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| An adjudicator's phone drops off Wi-Fi | Nothing to do. Marks are saved on the phone first and kept until the server confirms them; the phone sends them again by itself when it reconnects, and a repeat send never counts twice. The live board shows "Marks saved on the phone, not sent yet" while it waits |
| An adjudicator's page is refreshed, or the browser closes, mid-round | Nothing is lost. What they had marked so far comes back, and marks they had already confirmed are sent when the page opens |
| A phone dies or cannot connect | Use **Paper marks** (scrutineer menu): choose the adjudicator, type in their paper sheet, confirm. It is recorded as entered by the scrutineer. Print blank sheets beforehand from the same screen |
| The scrutineer started the wrong round | **Take off the floor** on the Rounds screen, available until an adjudicator has submitted |
| Laptop 2 stops or restarts | Run `pnpm venue` again. Marks already saved are kept, including a submission that was being saved when it stopped; phones reconnect by themselves and stay signed in |
| Laptop 2 fails for good | Laptop 3 takes over: see below |

## Laptop 3 takes over

Laptop 3 needs the same setup as Laptop 2 (the project, `pnpm install`, and a `backend\.env` with the same settings) and must be able to read the backup folder. Do this setup, and the rehearsal below, before the event.

1. On Laptop 3, restore the newest backup: `pnpm --filter @bis/backend restore`. It looks in `BACKUP_DIRS`, checks the copy is a whole BIS database, shows when its last recorded action was and how much it holds, and puts it in place. It never deletes anything: if a database is already there it stops and asks you to add `--replace`, which moves the old one aside.
2. Start it: `pnpm venue`.
3. Give Laptop 3 the address Laptop 2 had (set it in the router), or tell everyone the new address.
4. Check the Rounds screen shows the round you expect. Anything done after the last backup is missing: the scrutineer's screen and the adjudicators' phones show what the server has, and a phone that still holds unsent marks sends them.

To restore by hand instead, or to go back to an earlier copy, name the file: `pnpm --filter @bis/backend restore E:\bis-backups\bis-20261010-103000.db --replace`.

A backup is made when the server starts, every 5 minutes (`BACKUP_INTERVAL_MINUTES`), and after every approval. The newest 30 copies in each folder are kept.

### Rehearsal (do it once, a day before)

1. On Laptop 2, run a few rounds of the sample (`pnpm seed` on a spare database) with two phones.
2. Pull the USB drive out and plug it in again. The scrutineer screen shows the backup notice, then clears.
3. Switch a phone's Wi-Fi off, confirm marks, close the browser, switch Wi-Fi on, open the page. The marks arrive.
4. Stop the server mid-round (close its window) and start it again. Phones keep their place.
5. Stop Laptop 2 for good. On Laptop 3, run the steps above. Time it; it should take a few minutes.
6. Type in a paper sheet from the Paper marks screen.

## Phones, and the offline copy of the app

Marks are safe on a phone whatever the connection, without any of the setup in this section: they are stored in the phone's own storage before they are sent, and they survive a refresh, a closed browser or a flat battery.

What needs setup is **opening the page while the Wi-Fi is off**. A phone that has the page open keeps working through a Wi-Fi drop. A phone that reloads the page while offline shows the browser's "no connection" page until the Wi-Fi is back, unless it has an offline copy of the app. Browsers only allow that on a secure (`https://`) address, and the venue's `http://192.168.1.10:4000` is not one. Choose one:

- **Do nothing.** Everything above still works. Tell adjudicators not to refresh the page when the Wi-Fi drops, and to reopen it once the Wi-Fi is back.
- **Serve over HTTPS** (about an hour once, plus a few minutes per phone):
  1. On Laptop 2 install [mkcert](https://github.com/FiloSottile/mkcert) and run `mkcert -install`, then `mkcert -cert-file certs\bis.crt -key-file certs\bis.key 192.168.1.10 localhost` (use Laptop 2's address).
  2. In `backend\.env` set `TLS_CERT=./certs/bis.crt` and `TLS_KEY=./certs/bis.key`, and restart. Everyone now opens `https://192.168.1.10:4000`.
  3. Each phone must trust the certificate once. Copy `rootCA.pem` (in the folder `mkcert -CAROOT` prints) to the phone. Android: Settings, Security, Install a certificate, CA certificate. iPhone: open the file, install the profile, then Settings, General, About, Certificate Trust Settings, switch it on. Without this step phones show a security warning and will not keep the offline copy.
  4. Open the address once while on the Wi-Fi. The phone then keeps the app, and can open it with no connection. "Add to Home screen" installs it like an app.
- On Android Chrome only, a shortcut without certificates: open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://192.168.1.10:4000`, enable it and restart Chrome. Use it only on phones you control.

A new version of the app waits until the browser is closed and reopened, so an update never interrupts a round. After updating the server, close and reopen the page on every phone.

### Restoring a backup by hand

If the command does not work: stop the server; in `backend\data` move `bis.db`, `bis.db-wal` and `bis.db-shm` somewhere safe (do not delete them); copy the newest `bis-YYYYMMDD-HHMMSS.db` to `backend\data\bis.db`; start the server.

## After the event

The results are in the database on Laptop 2. Uploading them to the online site arrives in Phase 5; until then, keep `backend\data\bis.db` and the backup folders safe.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `PORT` | 4000 | Port the server listens on |
| `HOST` | 0.0.0.0 | `0.0.0.0` lets other devices connect |
| `DATABASE_PATH` | `./data/bis.db` | The database file |
| `COOKIE_SECRET` | random, kept beside the database | Signs sign-in cookies |
| `BACKUP_DIRS` | `./data/backups` | Comma-separated backup folders |
| `BACKUP_INTERVAL_MINUTES` | 5 | `0` turns the timer off |
| `FRONTEND_DIR` | `../frontend/dist` | The built screens; empty turns serving them off |
| `TLS_CERT`, `TLS_KEY` | (off) | Serve HTTPS with this certificate and key; both or neither. Cookies are then `Secure` |
| `COOKIE_SECURE` | false, or true with a certificate | Set `true` only behind HTTPS |
