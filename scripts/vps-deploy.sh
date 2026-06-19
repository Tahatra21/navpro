#!/usr/bin/env bash
# Deploy NAVPRO on VPS (PM2) after git pull.
#
# Prerequisites on VPS:
#   - backend/.env with DATABASE_URL, JWT_SECRET, CORS_ORIGIN, SEED_DEMO_PASSWORD
#   - PM2 processes: navpro-backend (port 4000), navpro-frontend (port 3000)
#
# Usage:
#   cd /var/www/navpro
#   export NEXT_PUBLIC_API_URL=https://maharyuda.my.id   # your public URL
#   ./scripts/vps-deploy.sh
#
# Options:
#   SKIP_SEED=1          skip npm run seed:e2e
#   SKIP_FRONTEND=1      skip frontend build
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${NEXT_PUBLIC_API_URL:-https://maharyuda.my.id}"
CORS_EXPECT="${CORS_ORIGIN:-$API_URL}"

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f backend/.env ]] || die "backend/.env not found. Copy from backend/.env.example and configure."

if ! grep -q '^SEED_DEMO_PASSWORD=.' backend/.env 2>/dev/null; then
  die "Set SEED_DEMO_PASSWORD in backend/.env before running seed:e2e."
fi

log "=== NAVPRO deploy — $(date -Iseconds) ==="
log "API URL (frontend): $API_URL"

log "→ git pull"
git pull origin main

log "→ backend npm ci"
(cd backend && npm ci)

if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  log "→ seed:e2e (reset demo passwords + demo projects/notifications + HJT demo)"
  (cd backend && npm run seed:e2e)
else
  log "→ skip seed:e2e (SKIP_SEED=1)"
fi

if [[ "${SKIP_HJT_DEMO:-0}" != "1" ]]; then
  log "→ seed:hjt-demo (12 penawaran DEMO-HJT-*)"
  (cd backend && npm run seed:hjt-demo)
fi

log "→ pm2 restart navpro-backend"
pm2 restart navpro-backend --update-env

if [[ "${SKIP_FRONTEND:-0}" != "1" ]]; then
  log "→ frontend npm ci + build"
  (cd frontend && npm ci)
  (cd frontend && NEXT_PUBLIC_API_URL="$API_URL" npm run build)
  log "→ pm2 restart navpro-frontend"
  pm2 restart navpro-frontend
else
  log "→ skip frontend (SKIP_FRONTEND=1)"
fi

log "→ smoke test (optional)"
if grep -q '^SMOKE_PASSWORD=.' backend/.env 2>/dev/null; then
  set -a && source backend/.env && set +a
  export SMOKE_EMAIL="${SMOKE_EMAIL:-admin@navpro.app}"
  export API_URL="http://127.0.0.1:4000"
  (cd backend && npm run smoke) || log "WARN smoke test failed — check logs"
else
  log "SKIP smoke — set SMOKE_PASSWORD= same as SEED_DEMO_PASSWORD in backend/.env"
fi

log "=== Deploy selesai ==="
pm2 status
