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
- [ ] The MC screen on Laptop 3 shows the announcements.

## Running a round

1. Scrutineer: **Start** on the round in the Rounds screen. The round appears on the adjudicators' phones.
2. Adjudicators mark and submit. The live board shows each phone as waiting, marking or submitted, and flags a phone that has gone quiet for more than 20 seconds.
3. When all have submitted, the scrutineer opens Recall (early rounds) or Results (final). A tie at the recall cutoff is proposed by the scrutineer and confirmed by the chairperson.
4. Scrutineer: **Approve**, then **Publish**. Approving saves the result, the ranking points and a backup of the database. Publishing makes the result public and sends it to the MC.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| An adjudicator's phone drops off Wi-Fi | Nothing: the phone keeps the marks and sends them when it reconnects. A repeat send never counts twice |
| A phone dies | The server can take an adjudicator's marks typed in from the paper sheet (an audited action by the scrutineer). The screen for this arrives with the offline work in Phase 4; until then ask the developer to enter them |
| The scrutineer started the wrong round | **Take off the floor** on the Rounds screen, available until an adjudicator has submitted |
| Laptop 2 stops or restarts | Run `pnpm venue` again. Marks already saved are kept, including a submission that was being saved when it stopped; phones reconnect by themselves |
| Laptop 2 fails for good | Use Laptop 3: copy the newest `bis-*.db` from the backup folder to `backend\data\bis.db` on Laptop 3, run `pnpm venue` there, and give Laptop 3 the address Laptop 2 had (or tell everyone the new address) |

### Restoring a backup

1. Stop the server.
2. In `backend\data`, delete `bis.db`, `bis.db-wal` and `bis.db-shm` if present.
3. Copy the newest `bis-YYYYMMDD-HHMMSS.db` from a backup folder to `backend\data\bis.db`.
4. Start the server. Check the Rounds screen shows the state you expect.

A backup is made when the server starts, every 5 minutes (`BACKUP_INTERVAL_MINUTES`), and after every approval. The newest 30 copies in each folder are kept.

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
| `COOKIE_SECURE` | false | Set `true` only behind HTTPS |
