# The cloud server: the same program as the venue laptop, started with MODE=cloud, plus the built website.
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
ENV MODE=cloud HOST=0.0.0.0 PORT=4000 TRUST_PROXY=true \
    DATABASE_PATH=/data/bis.db BACKUP_DIRS=/data/backups FRONTEND_DIR=/app/frontend/dist
COPY --from=build /app /app
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
WORKDIR /app/backend
# Run directly, so nothing is downloaded when the container starts
CMD ["node_modules/.bin/tsx", "src/main.ts"]
