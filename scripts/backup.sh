#!/usr/bin/env sh
# Nightly backup of the database (safe while the shop is running) and uploads.
# Keeps the last 14 backups. Example crontab line (runs at 03:15):
#   15 3 * * * /opt/mt2lab/scripts/backup.sh /opt/mt2lab/data /opt/mt2lab/backups >> /var/log/mt2lab-backup.log 2>&1
# With Docker:  docker compose exec -T app sh scripts/backup.sh /data /data/backups
set -eu

DATA_DIR="${1:-/data}"
OUT_DIR="${2:-./backups}"
DB_FILE="${DB_FILE:-$DATA_DIR/mt2lab.db}"
KEEP="${KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT_DIR"
if [ ! -f "$DB_FILE" ]; then
  echo "Database not found at $DB_FILE" >&2
  exit 1
fi

# sqlite3 .backup takes a consistent copy even while the shop is writing.
sqlite3 "$DB_FILE" ".backup '$OUT_DIR/mt2lab-$STAMP.db'"
gzip -f "$OUT_DIR/mt2lab-$STAMP.db"
if [ -d "$DATA_DIR/uploads" ]; then
  tar -czf "$OUT_DIR/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads
fi

# Prune old backups.
ls -1t "$OUT_DIR"/mt2lab-*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$OUT_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "$(date -Iseconds) backup written to $OUT_DIR (mt2lab-$STAMP.db.gz)"
