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
6. Sign in as the admin and open **Fees and payment details**. Until the fees are saved, clubs cannot enter events.

## Connecting a venue laptop

In the venue laptop's `backend/.env`:

```
CLOUD_URL=https://<DOMAIN>
SYNC_TOKEN=<the secret for this laptop from SYNC_TOKENS>
VENUE_ID=<the venue name used in SYNC_TOKENS>
```

Restart the venue server. The Cloud sync screen then shows the cloud as connected. To cut a laptop off, remove its entry from `SYNC_TOKENS` and run `docker compose up -d`.

## Messenger messages to clubs

Clubs can connect Facebook Messenger so they hear when a payment is approved or rejected. It needs a Facebook Page for the organizer and a Meta app, set up once:

1. At developers.facebook.com create an app, add the **Messenger** product and connect the Page.
2. Fill in `.env`: `MESSENGER_PAGE_USERNAME` (the Page's username, as in m.me/<username>), `MESSENGER_PAGE_TOKEN` (the Page access token), `MESSENGER_APP_SECRET` (the app secret) and `MESSENGER_VERIFY_TOKEN` (any long random text you choose). Run `docker compose up -d`.
3. In the app's Messenger settings add the webhook `https://<DOMAIN>/api/messenger/webhook` with the same verify token, and subscribe the Page to `messages`, `messaging_postbacks` and `messaging_referrals`.
4. Test with a club account: Account, Connect Messenger, press Get Started, then approve a payment.

Facebook decides who may send what, and its rules change. A message about a payment goes out as an event update, which may need the app to pass Meta's review (`pages_messaging`) before it reaches people outside the app's testers. If a message is refused, the decision is still saved and the club still sees the status in BIS; the server log says why.

## Backups

The database is a single file in the `bis-data` volume. The server copies it into `/data/backups` about a second after every change and thins out old copies. That protects against mistakes and a bad restart, not against losing the server, so also copy the volume somewhere else every day, for example:

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

## Notes

- The server needs only one copy running; do not scale it up.
- A competition downloaded by a venue is held: entries and payments for it close online until it is released. If the venue laptop is lost, an admin can take it back with the `unlockCompetition` function.
- Check on the image without Caddy: `docker build -f deploy/Dockerfile -t bis-cloud .` from the repository root.
