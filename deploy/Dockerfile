# The BIS server and the built website in one image.
# Build from the repository root:  docker build -f deploy/Dockerfile -t bis-cloud .

FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY packages/shared/package.json packages/shared/
COPY packages/scoring/package.json packages/scoring/
RUN pnpm install --frozen-lockfile
COPY frontend frontend
COPY backend backend
COPY packages packages
RUN pnpm --filter frontend build

FROM node:24-bookworm-slim
WORKDIR /app
# No COOKIE_SECRET here: the server makes one and keeps it in its database, so it survives restarts and restores
# TRUST_PROXY=1 trusts only Caddy, the one proxy in front, so a visitor cannot invent the address sign-in limits use.
# COOKIE_SECURE: sign-in cookies only travel over HTTPS. ADJUDICATOR_PIN_DAYS: a PIN works one day either side of the date.
# BIS_DEPLOYED: this is a real server (staging or production). It needs DATA_KEY and refuses to load the sample accounts.
ENV BIS_DEPLOYED=true HOST=0.0.0.0 PORT=4000 TRUST_PROXY=1 COOKIE_SECURE=true ADJUDICATOR_PIN_DAYS=1 \
    DATABASE_PATH=/data/bis.db BACKUP_DIRS=/data/backups FRONTEND_DIR=/app/frontend/dist
COPY --from=build /app /app
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
WORKDIR /app/backend
# Run directly, so nothing is downloaded when the container starts
CMD ["node_modules/.bin/tsx", "src/main.ts"]
