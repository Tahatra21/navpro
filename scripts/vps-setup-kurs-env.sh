#!/usr/bin/env bash
# Setup / update backend/.env for NAVPRO VPS — validates DATABASE_URL & JWT_SECRET first.
#
# Usage (interactive — isi DB + JWT jika belum ada):
#   ./scripts/vps-setup-kurs-env.sh
#
# Usage (non-interactive):
#   ./scripts/vps-setup-kurs-env.sh \
#     --database-url 'postgresql://navpro:SECRET@127.0.0.1:5432/navpro' \
#     --jwt-secret "$(openssl rand -base64 48)" \
#     --cors-origin 'https://navpro.example.com'
#
# Usage (generate JWT otomatis jika kosong, DB dari flag):
#   ./scripts/vps-setup-kurs-env.sh --generate-jwt-secret \
#     --database-url 'postgresql://navpro:SECRET@127.0.0.1:5432/navpro' \
#     --cors-origin 'https://navpro.example.com'
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/backend/.env"
ENV_EXAMPLE="${ROOT}/backend/.env.example"
BACKUP_SUFFIX="bak.$(date +%Y%m%d-%H%M%S)"

DATABASE_URL_ARG=""
JWT_SECRET_ARG=""
CORS_ORIGIN_ARG=""
GENERATE_JWT=false
PROVIDER="frankfurter"
CHECK_ONLY=false

usage() {
  sed -n '2,18p' "$0" | tail -n +2
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --database-url) DATABASE_URL_ARG="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET_ARG="$2"; shift 2 ;;
    --cors-origin) CORS_ORIGIN_ARG="$2"; shift 2 ;;
    --generate-jwt-secret) GENERATE_JWT=true; shift ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    --check-only) CHECK_ONLY=true; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# --- read KEY from .env (no export, handles values without spaces) ---
env_get() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 1
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || return 1
}

env_set() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # escape sed replacement
    local esc="${val//\\/\\\\}"
    esc="${esc//|/\\|}"
    sed -i "s|^${key}=.*|${key}=${esc}|" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

is_placeholder_db() {
  local url="$1"
  [[ -z "$url" ]] && return 0
  [[ "$url" == *'USER:PASSWORD'* ]] && return 0
  [[ "$url" == *'CHANGE_ME'* ]] && return 0
  [[ "$url" == postgresql://* ]] && return 1
  return 0
}

is_weak_jwt() {
  local secret="$1"
  [[ -z "$secret" ]] && return 0
  [[ ${#secret} -lt 32 ]] && return 0
  case "$secret" in
    navpro-dev-jwt-secret-change-in-production|change-me|secret|password|test|dev|development|12345678|qwerty)
      return 0
      ;;
  esac
  return 1
}

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    cp -a "$ENV_FILE" "${ENV_FILE}.${BACKUP_SUFFIX}"
    log "Backup: ${ENV_FILE}.${BACKUP_SUFFIX}"
    return
  fi
  [[ -f "$ENV_EXAMPLE" ]] || die "Missing ${ENV_EXAMPLE}. Run from git clone with backend/.env.example."
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  log "Created ${ENV_FILE} from .env.example"
}

prompt_if_needed() {
  local current_db current_jwt current_cors

  current_db="$(env_get DATABASE_URL 2>/dev/null || true)"
  current_jwt="$(env_get JWT_SECRET 2>/dev/null || true)"
  current_cors="$(env_get CORS_ORIGIN 2>/dev/null || true)"

  [[ -n "$DATABASE_URL_ARG" ]] && env_set DATABASE_URL "$DATABASE_URL_ARG"
  [[ -n "$JWT_SECRET_ARG" ]] && env_set JWT_SECRET "$JWT_SECRET_ARG"
  [[ -n "$CORS_ORIGIN_ARG" ]] && env_set CORS_ORIGIN "$CORS_ORIGIN_ARG"

  current_db="$(env_get DATABASE_URL 2>/dev/null || true)"
  current_jwt="$(env_get JWT_SECRET 2>/dev/null || true)"
  current_cors="$(env_get CORS_ORIGIN 2>/dev/null || true)"

  if is_placeholder_db "$current_db"; then
    log ""
    log "DATABASE_URL belum valid di ${ENV_FILE}"
    read -r -p "PostgreSQL user [navpro]: " pg_user
    pg_user="${pg_user:-navpro}"
    read -r -s -p "PostgreSQL password: " pg_pass
    echo ""
    read -r -p "PostgreSQL host [127.0.0.1]: " pg_host
    pg_host="${pg_host:-127.0.0.1}"
    read -r -p "PostgreSQL port [5432]: " pg_port
    pg_port="${pg_port:-5432}"
    read -r -p "Database name [navpro]: " pg_db
    pg_db="${pg_db:-navpro}"
    # URL-encode minimal: warn if password has special chars
    env_set DATABASE_URL "postgresql://${pg_user}:${pg_pass}@${pg_host}:${pg_port}/${pg_db}"
    log "DATABASE_URL disimpan."
  fi

  current_jwt="$(env_get JWT_SECRET 2>/dev/null || true)"
  if is_weak_jwt "$current_jwt"; then
    if $GENERATE_JWT || [[ -z "$current_jwt" ]]; then
      if command -v openssl >/dev/null 2>&1; then
        new_jwt="$(openssl rand -base64 48 | tr -d '\n')"
        env_set JWT_SECRET "$new_jwt"
        log "JWT_SECRET digenerate otomatis (48 byte base64)."
      else
        die "JWT_SECRET kosong/lemah dan openssl tidak tersedia. Pasang openssl atau gunakan --jwt-secret."
      fi
    else
      log ""
      read -r -s -p "JWT_SECRET (min 32 karakter, Enter = generate): " jwt_in
      echo ""
      if [[ -z "$jwt_in" ]]; then
        new_jwt="$(openssl rand -base64 48 | tr -d '\n')"
        env_set JWT_SECRET "$new_jwt"
        log "JWT_SECRET digenerate."
      else
        is_weak_jwt "$jwt_in" && die "JWT_SECRET terlalu pendek atau termasuk daftar kata lemah."
        env_set JWT_SECRET "$jwt_in"
      fi
    fi
  fi

  current_cors="$(env_get CORS_ORIGIN 2>/dev/null || true)"
  if [[ -z "$current_cors" ]] || [[ "$current_cors" == *localhost* && "${NODE_ENV:-production}" == production ]]; then
    if [[ -n "$CORS_ORIGIN_ARG" ]]; then
      env_set CORS_ORIGIN "$CORS_ORIGIN_ARG"
    else
      log ""
      read -r -p "CORS_ORIGIN (URL frontend, mis. https://navpro.domain.com): " cors_in
      [[ -n "$cors_in" ]] || die "CORS_ORIGIN wajib di production."
      env_set CORS_ORIGIN "$cors_in"
    fi
  fi

  # Production defaults
  env_set NODE_ENV "${NODE_ENV:-production}"
  grep -q '^PORT=' "$ENV_FILE" || env_set PORT 4000
}

validate_required() {
  local db jwt cors
  db="$(env_get DATABASE_URL)"
  jwt="$(env_get JWT_SECRET)"
  cors="$(env_get CORS_ORIGIN)"

  is_placeholder_db "$db" && die "DATABASE_URL masih placeholder. Jalankan ulang dengan --database-url atau input interaktif."
  is_weak_jwt "$jwt" && die "JWT_SECRET masih kosong/lemah (<32 char). Gunakan --generate-jwt-secret atau --jwt-secret."
  [[ -z "$cors" ]] && die "CORS_ORIGIN kosong."

  # Test Postgres connection if psql available
  if command -v psql >/dev/null 2>&1; then
    if ! psql "$db" -c 'SELECT 1' >/dev/null 2>&1; then
      die "psql gagal connect ke DATABASE_URL. Periksa user/password/database Postgres."
    fi
    log "OK  PostgreSQL connection"
  else
    log "SKIP psql test (psql tidak terinstall)"
  fi

  log "OK  DATABASE_URL, JWT_SECRET, CORS_ORIGIN valid"
}

apply_kurs_env() {
  env_set EXCHANGE_RATE_PROVIDER "$PROVIDER"
  env_set EXCHANGE_RATE_AUTO_SYNC true
  env_set EXCHANGE_RATE_SYNC_HOUR_WIB 9
  env_set EXCHANGE_RATE_MIN 10000
  env_set EXCHANGE_RATE_MAX 25000
  env_set EXCHANGE_RATE_MAX_DELTA_PERCENT 5
  env_set EXCHANGE_RATE_FAIL_NOTIFY_STREAK 3
  env_set EXCHANGE_RATE_CURRENCIES USD,EUR,SGD
  env_set EXCHANGE_RATE_FETCH_TIMEOUT_MS 10000
  env_set EXCHANGE_RATE_LOCK_TTL_SEC 120
  log "OK  EXCHANGE_RATE_* diperbarui (provider=${PROVIDER})"
}

main() {
  log "NAVPRO VPS env setup — ${ENV_FILE}"
  ensure_env_file
  prompt_if_needed
  validate_required

  if $CHECK_ONLY; then
    log "Check-only selesai."
    exit 0
  fi

  apply_kurs_env

  log ""
  log "=== Selesai. Restart backend: ==="
  log "  pm2 restart navpro-backend --update-env"
  log ""
  log "EXCHANGE_RATE vars:"
  grep '^EXCHANGE_RATE' "$ENV_FILE" || true
}

main "$@"
