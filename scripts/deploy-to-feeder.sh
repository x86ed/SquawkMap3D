#!/usr/bin/env bash
# Deploys a static export of SquawkMap3D to the ADS-B feeder box as its own
# Docker sidecar container — the same pattern every other tool on that box
# already uses (piaware, dump978, skystats, ...), independent of the box's
# existing `docker compose` stack. See
# openspec/changes/deploy-to-feeder/design.md for the full rationale
# (including why this isn't a lighttpd-based deploy — see that doc's
# Context for the real-box reconnaissance that superseded the original
# plan); openspec/changes/deploy-to-feeder/tasks.md for the checklist this
# script implements.
#
# Usage: bash scripts/deploy-to-feeder.sh   (or: npm run deploy:feeder)
# All settings below are overridable via environment variables.

set -euo pipefail

FEEDER_HOST="${FEEDER_HOST:-adsb-feeder.local}"
FEEDER_USER="${FEEDER_USER:-root}"
FEEDER_SSH_KEY="${FEEDER_SSH_KEY:-$HOME/.ssh/adsb_feeder}"
FEEDER_PORT="${FEEDER_PORT:-7500}"
REMOTE_DIR="${REMOTE_DIR:-/opt/squawkmap3d}"
CONTAINER_NAME="${CONTAINER_NAME:-squawkmap3d}"
IMAGE_TAG="${IMAGE_TAG:-squawkmap3d:latest}"

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

EXPECTED_FEEDER_URL="http://${FEEDER_HOST}:8080/data/aircraft.json"

# --- 1. Preflight ------------------------------------------------------

log "Preflight checks"

command -v rsync >/dev/null 2>&1 || fail "rsync is required locally but was not found on PATH"
command -v ssh >/dev/null 2>&1 || fail "ssh is required locally but was not found on PATH"

[ -f "$FEEDER_SSH_KEY" ] || fail "SSH key not found at $FEEDER_SSH_KEY (set FEEDER_SSH_KEY to override)"

remote true 2>/dev/null || fail "could not reach $SSH_TARGET over SSH with key $FEEDER_SSH_KEY — check the feeder is reachable and the key is authorized"

remote "docker version" >/dev/null 2>&1 || fail "Docker was not found (or its daemon is not running) on $FEEDER_HOST — this deploy runs SquawkMap3D as a Docker container, matching every other tool already on this box. Resolve manually before retrying."

ENV_FILE="$REPO_ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  warn ".env.local not found at $ENV_FILE — the build will ship without NEXT_PUBLIC_MAPTILER_KEY and the map will not render"
else
  if ! grep -q "^NEXT_PUBLIC_MAPTILER_KEY=.\+" "$ENV_FILE"; then
    warn "NEXT_PUBLIC_MAPTILER_KEY is not set in $ENV_FILE — the map will not render on the deployed build"
  fi
  if grep -q "^NEXT_PUBLIC_FEEDER_URL=" "$ENV_FILE" && ! grep -qF "NEXT_PUBLIC_FEEDER_URL=$EXPECTED_FEEDER_URL" "$ENV_FILE"; then
    warn "NEXT_PUBLIC_FEEDER_URL in $ENV_FILE does not match $EXPECTED_FEEDER_URL — this feeder's ultrafeeder container serves aircraft.json there (already CORS-enabled). Recommended: NEXT_PUBLIC_FEEDER_URL=$EXPECTED_FEEDER_URL"
  fi
fi

# --- 2. Build locally ----------------------------------------------------

log "Building static export locally (npm run build)"
( cd "$REPO_ROOT" && npm run build )

[ -d "$REPO_ROOT/out" ] || fail "build did not produce $REPO_ROOT/out — check next.config.js has output: \"export\""

# --- 3. Ship the payload --------------------------------------------------

log "Shipping build to $SSH_TARGET:$REMOTE_DIR"
remote "mkdir -p '$REMOTE_DIR'"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$REPO_ROOT/out/" "$SSH_TARGET:$REMOTE_DIR/out/"
scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/Dockerfile.squawkmap3d" "$SSH_TARGET:$REMOTE_DIR/Dockerfile" >/dev/null
scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/squawkmap3d.nginx.conf" "$SSH_TARGET:$REMOTE_DIR/squawkmap3d.nginx.conf" >/dev/null

# --- 4. Build and (re)run the container on the box ------------------------

log "Building image on the feeder box (native arch, no cross-compilation)"
# Legacy builder, not BuildKit: this Dockerfile needs no BuildKit-only
# syntax, and the feeder box's Docker install lacks the buildx plugin.
remote "cd '$REMOTE_DIR' && DOCKER_BUILDKIT=0 docker build -t '$IMAGE_TAG' ."

log "Starting container $CONTAINER_NAME on port $FEEDER_PORT"
remote "docker rm -f '$CONTAINER_NAME' >/dev/null 2>&1 || true"
remote "docker run -d --name '$CONTAINER_NAME' --restart unless-stopped -p '$FEEDER_PORT:80' --add-host=host.docker.internal:host-gateway '$IMAGE_TAG'" >/dev/null

# --- 5. Health check --------------------------------------------------

log "Waiting for http://$FEEDER_HOST:$FEEDER_PORT/api/health to come up"

# curl's own resolver has been observed to fail/timeout against this
# hostname's mDNS (.local) address on some networks even though `ssh`
# resolves it fine (macOS's system resolver handles mDNS; curl's built-in
# one doesn't always). Resolve once up front and pin curl to that IP via
# --resolve (keeps the Host header correct) so the health check doesn't
# false-negative a deploy that actually succeeded.
FEEDER_IP="$(
  { command -v dscacheutil >/dev/null 2>&1 && dscacheutil -q host -a name "$FEEDER_HOST" 2>/dev/null | awk '/^ip_address:/ {print $2; exit}'; } ||
  { command -v getent >/dev/null 2>&1 && getent ahosts "$FEEDER_HOST" 2>/dev/null | awk '{print $1; exit}'; } ||
  true
)"
CURL_RESOLVE_OPTS=()
if [ -n "$FEEDER_IP" ]; then
  CURL_RESOLVE_OPTS=(--resolve "$FEEDER_HOST:$FEEDER_PORT:$FEEDER_IP")
fi

HEALTHY=0
for _ in $(seq 1 10); do
  RESPONSE="$(curl -fsS "${CURL_RESOLVE_OPTS[@]}" --max-time 5 "http://$FEEDER_HOST:$FEEDER_PORT/api/health" 2>/dev/null || true)"
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
