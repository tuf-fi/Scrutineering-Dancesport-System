# Running the online server

The online server is the same program as the venue laptop, started with `MODE=cloud`. It serves the website, takes registration and payments, shows public results, and receives results from the venue.

## Set up (once)

You need a small server with Docker, and a domain name pointing at it. Ports 80 and 443 must be open.

1. Copy this repository to the server.
2. In `deploy/`, copy `.env.example` to `.env` and fill it in:
   - `DOMAIN`: the address people will use.
   - `SYNC_TOKENS`: one secret per venue laptop, `venue-name=secret`, separated by commas. Secrets are at least 16 characters. Make one with `openssl rand -hex 24`.
3. Start it: `docker compose up -d --build`. Caddy gets the HTTPS certificate on its own.
4. Create the first admin: `docker compose exec app node_modules/.bin/tsx src/db/create-admin-cli.ts <username> "<Full name>"`. It prints a password; sign in and change it.
5. Check `https://<DOMAIN>/api/health`. It should say `"mode":"cloud"`.

## Connecting a venue laptop

In the venue laptop's `backend/.env`:

```
CLOUD_URL=https://<DOMAIN>
SYNC_TOKEN=<the secret for this laptop from SYNC_TOKENS>
VENUE_ID=<the venue name used in SYNC_TOKENS>
```

Restart the venue server. The Cloud sync screen then shows the cloud as connected. To cut a laptop off, remove its entry from `SYNC_TOKENS` and run `docker compose up -d`.

## Backups

The database is a single file in the `bis-data` volume. The server copies it into `/data/backups` about a second after every change and thins out old copies. That protects against mistakes and a bad restart, not against losing the server, so also copy the volume somewhere else every day, for example:

```
docker compose cp app:/data/backups ./offsite
```

Restore: stop the app (`docker compose stop app`), put the chosen backup in the volume as `bis.db` and start it again.

## Updating

`git pull`, then `docker compose up -d --build`. Database changes are applied when the server starts.

## Notes

- The server needs only one copy running; do not scale it up.
- A competition downloaded by a venue is held: entries and payments for it close online until it is released. If the venue laptop is lost, an admin can take it back with the `unlockCompetition` function.
- Check on the image without Caddy: `docker build -f deploy/Dockerfile -t bis-cloud .` from the repository root.
