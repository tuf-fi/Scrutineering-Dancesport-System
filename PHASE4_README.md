# Phase 4: Offline Safety

Goal: nothing is lost when the Wi-Fi drops, a phone dies, a browser is closed or the server stops. See [PHASE3_README.md](PHASE3_README.md) for the server this builds on and [VENUE.md](VENUE.md) for how to run and recover.

## Status: built

| Step | What | Status |
| --- | --- | --- |
| 1 | Marks held in the phone's own storage | Done |
| 2 | Sending that never loses marks and never counts them twice | Done |
| 3 | Scrutineer's board shows a phone holding unsent marks | Done |
| 4 | Paper marks screen for the scrutineer | Done |
| 5 | Offline copy of the app (PWA) and optional HTTPS | Built; **not checked in a real browser** |
| 6 | Laptop 3 takeover command and rehearsal | Done |
| 7 | Tests of a bad day: Wi-Fi off, browser killed, server restarted | Done |

Tests added: 21 frontend, 18 backend. All suites pass (50 scoring, 129 backend, 218 frontend).

## What was built

### 1. Marks held on the phone
`frontend/src/lib/phoneDb.ts` keeps two things in the phone's IndexedDB: **confirmed marks** waiting for the server, and **answers in progress** on the mark screen. Both survive a refresh, a closed browser and a flat battery. A browser with no IndexedDB falls back to memory, so marks then survive only until a refresh.

### 2. Sending
When the adjudicator confirms, the marks are written to the phone's storage first and only then sent. The sending rules are one function (`lib/sendPending.ts`) used by the screen and by the tests:

| Server's answer | What the phone does |
| --- | --- |
| Accepted (including marks it already has) | Forget them, and clear the draft |
| Wi-Fi down, server stopped, server error, or the phone must sign in again | Keep them and try again in a few seconds, and whenever the connection returns |
| Refused for good: bad marks, not on this panel, no such round, round not open, already submitted differently | Forget them and tell the adjudicator why |

The server stores a repeated submission once, so a reply lost on the way back never produces double marks. Pending marks are not sent by a different adjudicator who signs in on the same phone.

### 3. The live board
Each heartbeat says which round the phone holds unsent marks for. The scrutineer's board shows "Marks saved on the phone, not sent yet", next to the existing "No response for N s" flag for a quiet phone.

### 4. Paper marks
Scrutineer menu, **Paper marks**: pick the round on the floor, pick an adjudicator who has not submitted, type in their sheet using the same mark sheet the phone shows, confirm. The server records it as entered by the scrutineer (audited). A link prints the blank sheets for the event. Not available to the chairperson. New server function: `getMarkingTask` (what there is to mark in a round that has started).

### 5. Offline copy of the app (PWA)
The app has a manifest, icons and a service worker that caches the screens and falls back to the cached page for any screen address. It never caches `/api` or the socket, so data is always current. A new version waits until the browser is closed and reopened, so an update cannot interrupt a round. The server sends `no-cache` for the page, the service worker and the manifest, and keeps hashed files for a year.

**Limit that matters:** browsers allow a service worker only on HTTPS or `localhost`. The venue address `http://192.168.x.x:4000` is neither, so by default **phones will not keep an offline copy**. Marks are still safe (steps 1 and 2) and a phone that already has the page open works through a Wi-Fi drop; only reloading the page while offline fails. The server can serve HTTPS (`TLS_CERT`, `TLS_KEY`), and [VENUE.md](VENUE.md) explains making a certificate with mkcert and trusting it on phones, or the Android Chrome flag.

### 6. Laptop 3 takeover
`pnpm --filter @bis/backend restore` finds the newest backup in `BACKUP_DIRS`, opens it read-only to check it is a whole BIS database (integrity check, expected tables), prints when its last action was and what it holds, and puts it in place. It never deletes: an existing database stops it unless `--replace`, which moves the old database and its write-ahead log aside. [VENUE.md](VENUE.md) has the steps and a rehearsal checklist.

## How it was checked
- **The bad-day test** (`backend/src/offline.test.ts`) runs the frontend's own phone code against the real server: marks confirmed, Wi-Fi off (server stopped), browser killed, server restarted on the same database, marks arrive once; a reply lost after the server stored the marks is retried without double counting; a refused send is dropped; a signed-out send is kept.
- **Phone storage** is tested with a simulated browser restart; the sending rules are tested through the real adjudicator screen.
- **HTTPS** is tested with a test-only certificate: a trusting client connects, an untrusting one is refused, cookies are `Secure`.
- **Restore** is tested against real backups taken by the server, plus a command-line run: server makes a backup, `restore` puts it on a second path, a second run refuses to overwrite.
- **The production build** was served by the real server and checked for the service worker, manifest, icons and cache headers.

## Not verified, and open
- **No real browser or phone was used.** The service worker registering, the app opening offline, installing to the home screen and trusting a certificate on Android and iPhone are untested. Run the rehearsal in [VENUE.md](VENUE.md) on the actual phones before relying on any of it.
- **The mark screen's draft** is restored from the phone, but a draft is not shown to the scrutineer; only confirmed marks are.
- **Pending marks across rounds:** if a phone holds marks for a round that has closed, the server refuses them and they are dropped with a message. The scrutineer can then enter the paper sheet.
- **Not started by itself:** the server does not start when Windows starts, and Laptop 3 does not watch Laptop 2 and take over automatically; the takeover is a few minutes of manual steps.
