#!/usr/bin/env bash
# migrate.sh — Run Alembic migrations inside the backend Docker service.
#
# Usage:
#   ./migrate.sh upgrade head      # apply all pending migrations
#   ./migrate.sh downgrade -1      # roll back one migration
#   ./migrate.sh current           # show current revision
#   ./migrate.sh history           # show full migration history

set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/docker-compose.yml"
CMD="${*:-upgrade head}"

echo "→ Running: alembic $CMD"
docker compose -f "$COMPOSE_FILE" run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-uxr}:${POSTGRES_PASSWORD:-uxr_secret}@postgres:5432/${POSTGRES_DB:-uxr_db}" \
  backend sh -c "alembic -c alembic.ini $CMD"
