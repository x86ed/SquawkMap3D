## 1. Static export config

- [x] 1.1 In `next.config.js`, add `output: "export"` to `nextConfig`
- [x] 1.2 In `app/api/health/route.ts`, add `export const dynamic = "force-static";`
- [x] 1.3 Run `npm run build` locally and confirm `out/` is produced, containing the app shell, all JS/CSS/vendored assets, and `out/api/health`
- [x] 1.4 Serve `out/` locally with any static file server and confirm `/` loads with no console errors and `GET /api/health` returns the expected JSON body

## 2. Real-box reconnaissance (read-only)

- [x] 2.0 Before designing the serving mechanism, confirm what's actually running on the feeder box rather than assuming — SSH in, check for lighttpd/nginx/Docker, inspect `docker ps` if present, curl the box's HTTP ports to see what's actually reachable and what headers come back. **Findings**: the box runs dirkhh's Docker-based "ADS-B Feeder Image" (Debian 12, aarch64) — no host lighttpd/nginx; `ultrafeeder` container publishes port 8080 with `aircraft.json` already served with `Access-Control-Allow-Origin: *`; Docker + `docker compose` present and used for every existing tool (piaware, dump978, skystats, etc.). This superseded the original lighttpd/symlink design — see design.md's corrected Context and Decisions 4/6.

## 3. Docker image and deploy script

- [x] 3.1 Add `scripts/Dockerfile.squawkmap3d`: minimal `nginx:alpine` base, `COPY out/ /usr/share/nginx/html/`, no build step (the actual Next.js build already happened locally). **Follow-up fix after real-deploy testing**: also `COPY`s `scripts/squawkmap3d.nginx.conf` over the image's default server block — `nginx:alpine`'s default `mime.types` has no `.mjs` entry, which broke MapLibre's worker script (served as `application/octet-stream`, rejected by browsers under strict module-script MIME checking) and left the map blank. Fixed and verified live in a real browser against the deployed site — see design.md's Risks for the full writeup
- [x] 3.2 Add `scripts/deploy-to-feeder.sh` (bash, `set -euo pipefail`) with configurable-via-env-var, defaulted settings: `FEEDER_HOST` (default `adsb-feeder.local`), `FEEDER_USER` (default `root`), `FEEDER_SSH_KEY` (default `~/.ssh/adsb_feeder`), `FEEDER_PORT` (default `7500`), `REMOTE_DIR` (default `/opt/squawkmap3d`), `CONTAINER_NAME` (default `squawkmap3d`), `IMAGE_TAG` (default `squawkmap3d:latest`)
- [x] 3.3 Preflight checks (abort with a specific error, before any remote/destructive action, on failure — see spec.md "Deploy script fails fast on missing prerequisites"):
  - `rsync` and `ssh` available locally
  - SSH key at `$FEEDER_SSH_KEY` exists
  - `ssh ... true` succeeds (feeder reachable)
  - remote `docker version` succeeds (Docker present and daemon running)
  - warn (non-fatal) if local `.env.local` is missing, has no `NEXT_PUBLIC_MAPTILER_KEY` set, or has `NEXT_PUBLIC_FEEDER_URL` set to something other than `http://$FEEDER_HOST:8080/data/aircraft.json`
- [x] 3.4 Build: `npm run build` in the repo root, producing `out/`
- [x] 3.5 Ship `out/` and the Dockerfile to the box: `rsync -az --delete` `out/` to `$REMOTE_DIR/out/`, `scp` the Dockerfile to `$REMOTE_DIR/Dockerfile`
- [x] 3.6 Over SSH: `docker build -t "$IMAGE_TAG" "$REMOTE_DIR"`, then `docker rm -f "$CONTAINER_NAME" 2>/dev/null || true`, then `docker run -d --name "$CONTAINER_NAME" --restart unless-stopped -p "$FEEDER_PORT:80" "$IMAGE_TAG"`
- [x] 3.7 Health check: poll `http://$FEEDER_HOST:$FEEDER_PORT/api/health` from the local machine, bounded retries, checking for `"status":"ok"`; `exit 1` with the last response on failure
- [x] 3.8 Make the script executable; `deploy:feeder` added to `package.json`

## 4. Documentation

- [x] 4.1 Add a "Deploying to the feeder" section to `README.md`: prerequisites (SSH key, Docker already present on the box, `.env.local` with `NEXT_PUBLIC_FEEDER_URL=http://adsb-feeder.local:8080/data/aircraft.json`), the command, what it does, how to check logs (`docker logs -f squawkmap3d`), how to uninstall (`docker rm -f squawkmap3d && docker rmi squawkmap3d:latest`)

## 5. Verification (real box)

**Sideloaded, parallel deployment — tar1090/ultrafeeder must keep working, unaffected, throughout:**

- [x] 5.0 Baseline: confirmed tar1090 (`http://adsb-feeder.local:8080/`, actually the `ultrafeeder` container's own port) reachable, `200`, before the first deploy
- [x] 5.1 Ran `npm run deploy:feeder` (via `bash scripts/deploy-to-feeder.sh`) end-to-end against the real box. **First run's health check false-negatived**: the script reported failure, but the container was actually up and healthy (confirmed via direct-IP curl) — root cause was curl's own resolver timing out against the `.local` mDNS hostname on this dev machine (unrelated to the deploy itself; `ssh` resolves the same hostname fine via the OS resolver). Fixed by resolving the host once via `dscacheutil`/`getent` and pinning curl to that IP with `--resolve`. **Second run passed cleanly end-to-end**, including the health check: `{"status":"ok","service":"SquawkMap3D","timestamp":"..."}`
- [x] 5.2 Confirmed via SSH: `docker ps` shows `squawkmap3d` `Up`, `docker inspect` confirms `RestartPolicy: unless-stopped`
- [x] 5.3 Confirmed `curl http://<feeder-ip>:7500/` returns `200` (app shell loads). Live aircraft-render/CORS-in-browser check **deferred** — `plane-tracks-3d-layer` isn't merged yet, exactly as this task anticipated
- [x] 5.4 Corrected test methodology mid-verification: `docker kill squawkmap3d` (an explicit management command) does **not** trigger `unless-stopped` — confirmed this is intentional Docker behavior (restart policies react to the containerized process crashing on its own, not to `docker stop`/`docker kill`), not a bug. Restored service with `docker start`, then ran the real test: `docker exec squawkmap3d kill -9 1` (kills nginx's actual PID 1 from inside, a true unexpected-crash scenario) — confirmed the container's `StartedAt` timestamp jumped forward within ~5s (fresh restart) and `/api/health` was healthy again with no manual intervention
- [x] 5.5 Deploy script run three times total against the real box during this verification session (the failed-health-check attempt, the fixed retry, plus redeploys implicit in re-running) — every run completed the build/ship/`docker build`/`docker run` cycle cleanly, `docker rm -f` on a not-yet-existing/already-removed container never errored
- [x] 5.6 Confirmed via `docker ps`: all 12 pre-existing containers (`ultrafeeder`, `piaware`, `dump978`, `skystats`, `fr24feed`, etc.) show uninterrupted uptimes (`ultrafeeder` still "Up 4 days", unchanged) spanning before/after every deploy in this session — none were touched, restarted, or recreated. `http://<feeder-ip>:8080/` (tar1090/ultrafeeder) stayed `200` throughout. Uninstall itself (`docker rm -f squawkmap3d && docker rmi squawkmap3d:latest`) not yet exercised — leaving the deploy live per the user's intent, can be tested on request
- [x] 5.7 Ran both preflight-failure paths for real: `FEEDER_SSH_KEY=/tmp/does-not-exist` → aborted immediately with "SSH key not found," no remote connection attempted; `FEEDER_HOST=nonexistent-host-xyz.invalid` → aborted with "could not reach ... over SSH," before any build/ship. Both exit 1, no partial state left anywhere
- [x] 5.8 Run `npm run lint` and `npx tsc --noEmit` and confirm no regressions from the `next.config.js`/health-route changes — both clean; `npm test` also re-confirmed 7/7 passing
