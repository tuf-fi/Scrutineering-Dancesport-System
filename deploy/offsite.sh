#!/bin/sh
# Copies the newest database backups to another place once a day (see README.md, "Backups").
# Runs inside the rclone container. The place is described by OFFSITE_REMOTE and the RCLONE_CONFIG_* settings in .env.
: "${OFFSITE_REMOTE:?Set OFFSITE_REMOTE in .env}"
while true; do
  if rclone copy /data/backups "$OFFSITE_REMOTE" --max-age "${OFFSITE_MAX_AGE:-3d}" --log-level NOTICE; then
    echo "$(date -u +%FT%TZ) offsite copy done"
  else
    echo "$(date -u +%FT%TZ) offsite copy FAILED" >&2
  fi
  sleep "${OFFSITE_EVERY_SECONDS:-86400}"
done
