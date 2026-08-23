#!/usr/bin/env bash
# Deploys a static export of SquawkMap3D to the ADS-B feeder box, served by
# the box's existing lighttpd (the same web server tar1090 already depends
# on) on its own port, sideloaded alongside tar1090 without touching its
# config. See openspec/changes/deploy-to-feeder/design.md for the full
# rationale; openspec/changes/deploy-to-feeder/tasks.md for the checklist
# this script implements.
#
# Usage: bash scripts/deploy-to-feeder.sh   (or: npm run deploy:feeder)
# All settings below are overridable via environment variables.

set -euo pipefail

FEEDER_HOST="${FEEDER_HOST:-adsb-feeder.local}"
FEEDER_USER="${FEEDER_USER:-root}"
FEEDER_SSH_KEY="${FEEDER_SSH_KEY:-$HOME/.ssh/adsb_feeder}"
FEEDER_PORT="${FEEDER_PORT:-7500}"
REMOTE_DIR="${REMOTE_DIR:-/opt/squawkmap3d}"
SITE_CONF_NAME="${SITE_CONF_NAME:-98-squawkmap3d.conf}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSH_TARGET="${FEEDER_USER}@${FEEDER_HOST}"
SSH_OPTS=(-i "$FEEDER_SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10)

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

remote() {
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$@"
}

# --- 1. Preflight ------------------------------------------------------

log "Preflight checks"

command -v rsync >/dev/null 2>&1 || fail "rsync is required locally but was not found on PATH"
command -v ssh >/dev/null 2>&1 || fail "ssh is required locally but was not found on PATH"

[ -f "$FEEDER_SSH_KEY" ] || fail "SSH key not found at $FEEDER_SSH_KEY (set FEEDER_SSH_KEY to override)"

remote true 2>/dev/null || fail "could not reach $SSH_TARGET over SSH with key $FEEDER_SSH_KEY — check the feeder is reachable and the key is authorized"

if ! remote "command -v lighttpd" >/dev/null 2>&1 || ! remote "systemctl is-active --quiet lighttpd || systemctl is-enabled --quiet lighttpd" >/dev/null 2>&1; then
  fail "lighttpd was not found (or is not systemd-managed) on $FEEDER_HOST — this script expects a standard tar1090 install, which already depends on lighttpd. Resolve manually before retrying."
fi

ENV_FILE="$REPO_ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  warn ".env.local not found at $ENV_FILE — the build will ship without NEXT_PUBLIC_MAPTILER_KEY and the map will not render"
else
  if ! grep -q "^NEXT_PUBLIC_MAPTILER_KEY=.\+" "$ENV_FILE"; then
    warn "NEXT_PUBLIC_MAPTILER_KEY is not set in $ENV_FILE — the map will not render on the deployed build"
  fi
  if grep -q "^NEXT_PUBLIC_FEEDER_URL=" "$ENV_FILE" && ! grep -q "^NEXT_PUBLIC_FEEDER_URL=/data/aircraft\.json\s*$" "$ENV_FILE"; then
    warn "NEXT_PUBLIC_FEEDER_URL in $ENV_FILE is not /data/aircraft.json — this defeats the same-origin, no-CORS feeder wiring this deploy sets up (see design.md Decision 6). Recommended: NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json"
  fi
fi

# --- 2. Build locally ----------------------------------------------------

log "Building static export locally (npm run build)"
( cd "$REPO_ROOT" && npm run build )

[ -d "$REPO_ROOT/out" ] || fail "build did not produce $REPO_ROOT/out — check next.config.js has output: \"export\""

# --- 3. Ship the payload --------------------------------------------------

log "Shipping build to $SSH_TARGET:$REMOTE_DIR"
remote "mkdir -p '$REMOTE_DIR'"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$REPO_ROOT/out/" "$SSH_TARGET:$REMOTE_DIR/"

# --- 4. Feeder-local live-feed symlink ------------------------------------

log "Resolving feeder's decoder source for aircraft.json"

DECODER_SRC="$(remote '
  set -e
  if [ -f /etc/default/tar1090_instances ]; then
    awk "{print \$1; exit}" /etc/default/tar1090_instances
  fi
' 2>/dev/null || true)"

if [ -z "$DECODER_SRC" ] || ! remote "[ -f \"$DECODER_SRC/aircraft.json\" ]" 2>/dev/null; then
  DECODER_SRC=""
  for candidate in /run/dump1090-fa /run/readsb /run/adsbexchange-feed /run/dump1090 /run/dump1090-mutability /run/skyaware978 /run/shm; do
    if remote "[ -f '$candidate/aircraft.json' ]" 2>/dev/null; then
      DECODER_SRC="$candidate"
      break
    fi
  done
fi

if [ -n "$DECODER_SRC" ]; then
  log "Found decoder feed at $DECODER_SRC/aircraft.json — linking into $REMOTE_DIR/data/aircraft.json"
  remote "ln -sfn '$DECODER_SRC/aircraft.json' '$REMOTE_DIR/data/aircraft.json'"
else
  warn "no decoder aircraft.json found at any known location — aircraft layer will stay empty until one is available. This does not fail the deploy."
fi

# --- 5. Install/refresh the lighttpd site config --------------------------

log "Installing lighttpd site config on port $FEEDER_PORT"

RENDERED_CONF="$(mktemp)"
trap 'rm -f "$RENDERED_CONF"' EXIT

sed -e "s#__REMOTE_DIR__#$REMOTE_DIR#g" -e "s#__PORT__#$FEEDER_PORT#g" \
  "$SCRIPT_DIR/squawkmap3d.lighttpd.conf.template" > "$RENDERED_CONF"

scp "${SSH_OPTS[@]}" "$RENDERED_CONF" "$SSH_TARGET:/etc/lighttpd/conf-available/$SITE_CONF_NAME" >/dev/null

remote "
  set -e
  ln -sf '/etc/lighttpd/conf-available/$SITE_CONF_NAME' '/etc/lighttpd/conf-enabled/$SITE_CONF_NAME'
  lighttpd -tt -f /etc/lighttpd/lighttpd.conf
  systemctl reload lighttpd
"

# --- 6. Health check --------------------------------------------------

log "Waiting for http://$FEEDER_HOST:$FEEDER_PORT/api/health to come up"

HEALTHY=0
for _ in $(seq 1 10); do
  RESPONSE="$(curl -fsS --max-time 3 "http://$FEEDER_HOST:$FEEDER_PORT/api/health" 2>/dev/null || true)"
  if printf '%s' "$RESPONSE" | grep -q '"status":"ok"'; then
    HEALTHY=1
    break
  fi
  sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
  fail "health check failed: http://$FEEDER_HOST:$FEEDER_PORT/api/health did not respond with status ok within the timeout. Last response: ${RESPONSE:-<none>}"
fi

log "Deployed successfully: http://$FEEDER_HOST:$FEEDER_PORT"
