#!/bin/sh
set -e

log_info() { echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_warn() { echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_error() { echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1"; }

DATA_DIR="/app/data"
DATABASE_PATH="${DATABASE_PATH:-$DATA_DIR/design-patterns.db}"

mkdir -p "$DATA_DIR"

if [ "$SKIP_DB_SETUP" != "true" ]; then
  if [ ! -f "$DATABASE_PATH" ]; then
    log_info "Starting database setup..."

    if bun run migrate; then
      log_info "Migrations applied"
    else
      log_warn "Migrations may already be applied"
    fi

    if bun run seed; then
      log_info "Patterns seeded"
    else
      log_error "Failed to seed patterns"
    fi

    if bun run generate-embeddings; then
      log_info "Embeddings generated"
    else
      log_warn "Embeddings may already exist"
    fi

    if bun run setup-relationships; then
      log_info "Relationships configured"
    else
      log_warn "Relationships may already exist"
    fi

    log_info "Database setup complete"
  else
    log_info "Database already exists, skipping setup"
  fi
else
  log_info "Database setup skipped (SKIP_DB_SETUP=true)"
fi

log_info "Starting server in mode: $TRANSPORT_MODE"
log_info " HTTP port: $HTTP_PORT"
log_info " MCP endpoint: $MCP_ENDPOINT"

exec "$@"
