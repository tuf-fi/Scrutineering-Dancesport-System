# Setting up staging

Staging is a practice copy of production on its own server and its own database. Every change is tried here first, and the secretariat and adjudicators can rehearse on it without touching real entries. Production is in [PRODUCTION.md](PRODUCTION.md); the setting reference and backups are in [README.md](README.md).

It is built exactly like production, with the same image and the same commands. This page lists the commands once more so you can follow it alone, and says what is different.

## What is different from production

| | Production | Staging |
| --- | --- | --- |
| Server | Its own | **Its own, never beside production.** The compose file uses ports 80 and 443 and fixed volume names, and each server keeps its own database |
| Address | `bis.example.com` | A subdomain, for example `staging.example.com`, with its own DNS record |
| Settings file | `.env` from `.env.example` | `.env` from **`staging.env.example`** |
| `DATA_KEY` | Its own | **A different one** from production, so a leaked staging file says nothing about production |
| `ADJUDICATOR_PIN_DAYS` | `1` | `off`: PINs work on any day, so a past or future competition can be practised |
| Offsite backup | Yes | No (`OFFSITE_REMOTE` empty) |
| Sample data | Refused | **Refused too**: the server stops when `BIS_DEPLOYED=true` (set by the image), so the public sample accounts can never appear here |
| People | Real | Fake names, fake teams, fake emails |
| Payments | Recorded by hand from real GCash, Maya or bank payments | Recorded by hand from made-up ones. BIS has no payment gateway, so there are no payment keys to set |

Staging is reachable from the internet by anyone who knows the address. Do not put real people's details in it.

## What you need

The same as production: a Linux server with Docker and the Docker Compose plugin (a smaller one is fine), a subdomain whose **A record points at the staging server**, ports 80 and 443 open, and access to the repository. See "What you need first" in [PRODUCTION.md](PRODUCTION.md).

## Set up (once)

On the **staging server**:

```
# Docker and a firewall, as for production
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER           # then log out and back in
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

git clone <repository url> bis
cd bis/deploy
cp staging.env.example .env
nano .env
```

Set in `.env`:

| Setting | Set it to |
| --- | --- |
| `DOMAIN` | The staging address, for example `staging.example.com` |
| `DATA_KEY` | `openssl rand -hex 32`, **different from production** |
| `COOKIE_SECRET` | Leave empty |
| `ADJUDICATOR_PIN_DAYS` | `off` |
| `PUBLIC_RATE_LIMIT` | `600` |
| `OFFSITE_REMOTE` | Leave empty |

Build and start:

```
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Make the first admin:

```
docker compose exec app node_modules/.bin/tsx src/db/create-admin-cli.ts <email> "<Full name>"
```

Check it:

```
curl https://<staging address>/api/health        # {"status":"ok", ...}
```

Then sign in at `https://<staging address>/staff-access`, change the password, and set it up the way production is set up:

1. **Fees and payment details**: enter the fees and where to pay (use the real fees so prices match; use made-up account numbers if you like). Until they are saved, teams cannot enter events.
2. **Staff accounts**: add the secretariat. Add the scrutineer, chairperson and MC only when you are rehearsing those roles.
3. **Competitions**: create a practice competition with a card photo (a photo is required), then events, teams, competitors and adjudicators by hand, as in [../FLOW.md](../docs/product/FLOW.md).

Do **not** load the sample data. The server refuses to, and the sample accounts share a public password.

## The build, and checking it without Caddy

`docker compose up -d --build` builds `deploy/Dockerfile`: it installs the packages, builds the website, and runs the server on port 4000 behind Caddy. The details are in "How the build works" in [PRODUCTION.md](PRODUCTION.md). To check the image on its own, from the repository root:

```
docker build -f deploy/Dockerfile -t bis-cloud .
```

## Testing a change on staging

Every release goes here first, and the same commit goes to production afterwards.

On **your computer**, before pushing:

```
pnpm test
cd frontend && npx tsc -b
cd ../backend && npx tsc -b
cd .. && pnpm build
git push
```

On the **staging server**, in `deploy/`:

```
git pull
docker compose up -d --build
curl https://<staging address>/api/health
docker compose logs --tail 50 app
```

Then try the change in a browser, and on a real phone for anything an adjudicator touches. A new database migration runs by itself when the server starts; look at the log to see it did.

A fuller rehearsal of a whole competition, with the real staff and real phones on mobile data, is described in [../PILOT.md](../docs/operations/PILOT.md). Before any event, also run the automated rehearsals on your computer (they use a throwaway database, not staging):

```
pnpm e2e               # the whole competition, driven in a real browser (about six minutes)
pnpm loadtest          # ten phones marking while a crowd reads the public pages
```

See [../rehearsal/README.md](../rehearsal/README.md) for what they cover and do not cover.

## Starting again from clean

When staging has a mess you want to throw away, you can reset it, because it holds nothing real.

```
docker compose down -v        # deletes the staging database and certificates
docker compose up -d --build
# then make the admin again (see "Make the first admin")
```

`down -v` deletes the volumes. **Run it only on staging, never on production.** Check the folder and the address before you press Enter.

## Everyday commands

| Task | Command |
| --- | --- |
| Is everything running | `docker compose ps` |
| Watch the app | `docker compose logs -f app` |
| Restart the app | `docker compose restart app` |
| Change a setting | edit `.env`, then `docker compose up -d` |
| Update | `git pull`, then `docker compose up -d --build` |

## Trying it on your own computer

For a quick look without a server, run the same containers locally: in `deploy/`, a `.env` with `DOMAIN=localhost`, `DATA_KEY` set to 32 or more characters and `ADJUDICATOR_PIN_DAYS=off`, then `docker compose up -d --build`. The browser warns about the certificate, which Caddy makes for `localhost`. The override file `docker-compose.override.yml` also publishes the app on `127.0.0.1:4000`. Without Docker, use `pnpm dev` (the app and the website) or `pnpm dev:sample` (the website with sample data and no server); [../TEST_ACCOUNTS.md](../docs/operations/TEST_ACCOUNTS.md) lists the sample accounts, which work only there.
