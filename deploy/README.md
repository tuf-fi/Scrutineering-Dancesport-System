# Running the online server

The BIS server is one program that does everything: it serves the website, takes registration and payments, shows public results, and runs the rounds (staff on laptops, adjudicators on phones with a PIN, all over the internet). There is no venue server and no sync.

## Set up (once)

You need a small server with Docker, and a domain name pointing at it. Ports 80 and 443 must be open.

1. Copy this repository to the server.
2. In `deploy/`, copy `.env.example` to `.env` and fill it in:
   - `DOMAIN`: the address people will use.
   - `ADJUDICATOR_PIN_DAYS`: an adjudicator's PIN works this many days either side of the competition date (default 1; `off` only to practise with a past competition).
3. Start it: `docker compose up -d --build`. Caddy gets the HTTPS certificate on its own.
4. Create the first admin: `docker compose exec app node_modules/.bin/tsx src/db/create-admin-cli.ts <email> "<Full name>"`. It prints a password; sign in and change it.
5. Check `https://<DOMAIN>/api/health`. It should say `"status":"ok"`.
6. Sign in as the admin and open **Fees and payment details**. Until the fees are saved, teams cannot enter events.

## Settings

The compose file sets these for the server; change them in `.env` or the compose file only if you know why.

| Variable | What it does |
| --- | --- |
| `ADJUDICATOR_PIN_DAYS` | A PIN works only this many days either side of the competition date. Default 1. |
| `PUBLIC_RATE_LIMIT` | Requests a minute from one address for calls that need no sign-in, such as the public pages. Default 600; `off` turns it off. Many spectators on one mobile network can share an address, so keep it generous. |
| `TRUST_PROXY` | How many proxies sit in front of the server, used to tell visitors apart for the sign-in limits. 1 behind Caddy. |
| `COOKIE_SECURE` | The session cookie travels only over HTTPS. On in production. |
| `BACKUP_DIRS` | Folders the database is copied to, separated by commas. Default `/data/backups`. |
| `BACKUP_INTERVAL_MINUTES` | How often a backup is also taken, besides after every change. Default 5. |
| `COOKIE_SECRET` | Leave empty and the server makes and keeps its own. |

The old `MODE`, `CLOUD_URL`, `SYNC_TOKEN`, `SYNC_TOKENS`, `VENUE_ID`, `SYNC_DELAY_MS`, `TLS_CERT` and `TLS_KEY` no longer exist.

## Before a competition

- Check the server's clock. It decides which competition is current and which PINs work, so run NTP on the host.
- Check `ADJUDICATOR_PIN_DAYS` suits the event.
- Take a backup and check you can open it (see Backups).
- Open the site in a browser and check the console for Content-Security-Policy violations. The header is enforced, so anything it blocks is also broken on the page; if something legitimate is blocked, add its source to the policy in `Caddyfile` and run `docker compose up -d`.


## Backups

The database is a single file in the `bis-data` volume. The server copies it into `BACKUP_DIRS` (default `/data/backups`) about a second after every change and on an interval, and thins out old copies. If a folder fails, the scrutineer and admin see a warning. That protects against mistakes and a bad restart, not against losing the server, so also copy the volume somewhere else every day, for example:

```
docker compose cp app:/data/backups ./offsite
```

### Copying the backups to another place

A second service copies the newest backups to storage outside the server every day. It uses rclone, which speaks to S3-compatible storage (Backblaze B2, Wasabi, DigitalOcean Spaces), Google Drive, SFTP and many more. Describe the place in `.env` as in `.env.example` (`OFFSITE_REMOTE` and the `RCLONE_CONFIG_OFFSITE_*` settings), then:

```
docker compose --profile offsite up -d
docker compose logs offsite
```

The log should say "offsite copy done" once a day; "FAILED" means the copy did not happen, so look at the line above it. It only adds files, so the remote keeps the history. Set a lifecycle rule there (for example keep 90 days) so it does not grow forever. Check once in a while that you can open a copy from the remote and restore it.

Restore: stop the app (`docker compose stop app`), put the chosen backup in the volume as `bis.db` and start it again.

## Updating

`git pull`, then `docker compose up -d --build`. Database changes are applied when the server starts.

## Staging

Run staging on its own server, never next to production: the compose file uses ports 80 and 443 and fixed volume names, and each server keeps its own database.

1. Create a second server and point a subdomain at it (for example `staging.<domain>`).
2. Follow "Set up (once)", but copy `staging.env.example` to `.env` instead of `.env.example`.
3. Use fake teams and athletes only. Use PayMongo test keys, never live ones.
4. Update it like production (`git pull`, then `docker compose up -d --build`) and test every change here first.

## Notes

- The server needs only one copy running; do not scale it up.
- Security headers (HSTS, no framing, no sniffing) come from Caddy. Sign-in guesses are limited across all visitors, and each adjudicator PIN sign-in is logged.
- Check on the image without Caddy: `docker build -f deploy/Dockerfile -t bis-cloud .` from the repository root.
