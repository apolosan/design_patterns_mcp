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
    log_info "Iniciando setup do banco de dados..."

    if bun run migrate; then
      log_info "Migrações aplicadas"
    else
      log_warn "Migrações podem já estar aplicadas"
    fi

    if bun run seed; then
      log_info "Padrões populados"
    else
      log_error "Falha ao popular padrões"
    fi

    if bun run generate-embeddings; then
      log_info "Embeddings gerados"
    else
      log_warn "Embeddings podem já existir"
    fi

    if bun run setup-relationships; then
      log_info "Relacionamentos configurados"
    else
      log_warn "Relacionamentos podem já existir"
    fi

    log_info "Setup do banco concluído!"
  else
    log_info "Banco de dados já existe, pulando setup"
  fi
else
  log_info "Setup do banco pulado (SKIP_DB_SETUP=true)"
fi

log_info "Iniciando servidor em modo: $TRANSPORT_MODE"
log_info " Porta HTTP: $HTTP_PORT"
log_info " Endpoint MCP: $MCP_ENDPOINT"

exec "$@"
