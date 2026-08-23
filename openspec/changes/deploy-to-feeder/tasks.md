## 1. Static export config

- [ ] 1.1 In `next.config.js`, add `output: "export"` to `nextConfig`
- [ ] 1.2 In `app/api/health/route.ts`, add `export const dynamic = "force-static";` — required for `next build` to succeed under static export (verified during drafting: without this line, the build fails with `export const dynamic = "force-static"/export const revalidate not configured on route "/api/health" with "output: export"`)
- [ ] 1.3 Run `npm run build` locally and confirm it succeeds, producing `out/` with `index.html`, all JS/CSS chunks, vendored public assets (`aircraft-shapes/`, `aircraft-silhouettes/`, `data/*.geojson`, etc.), and `out/api/health` (an extensionless file containing the JSON health payload, frozen at build time)
- [ ] 1.4 Manually serve `out/` locally (e.g. `python3 -m http.server 8000 --directory out`) and confirm `GET /` loads the map app and `GET /api/health` returns the expected JSON body

## 2. Deploy script: build, ship, and feeder-local live-feed wiring

- [ ] 2.1 Add `scripts/deploy-to-feeder.sh` (bash, `set -euo pipefail`) with configurable-via-env-var, defaulted settings: `FEEDER_HOST` (default `adsb-feeder.local`), `FEEDER_USER` (default `root`), `FEEDER_SSH_KEY` (default `~/.ssh/adsb_feeder`), `FEEDER_PORT` (default `7500`), `REMOTE_DIR` (default `/opt/squawkmap3d`), `SERVICE_NAME` (default `squawkmap3d`)
- [ ] 2.2 Preflight checks (abort with a specific error, before any remote/destructive action, on failure — see spec.md "Deploy script fails fast on missing prerequisites"):
  - `rsync` and `ssh` are available locally
  - the SSH key at `$FEEDER_SSH_KEY` exists
  - `ssh -i "$FEEDER_SSH_KEY" "$FEEDER_USER@$FEEDER_HOST" true` succeeds (feeder reachable)
  - remote `python3 --version` is present (the static file server's runtime)
  - warn (non-fatal) if local `.env.local`/`.env.production.local` is missing, has no `NEXT_PUBLIC_MAPTILER_KEY` set, or has `NEXT_PUBLIC_FEEDER_URL` set to something other than `/data/aircraft.json` — the last one specifically defeats the same-origin, no-CORS feeder wiring from task 2.5/design.md Decision 6; recommend the exact value in the warning text
- [ ] 2.3 Build: run `npm run build` in the repo root (uses whatever local `.env.local` is present)
- [ ] 2.4 Ship the payload: `rsync -az --delete -e "ssh -i \"$FEEDER_SSH_KEY\"" out/ "$FEEDER_USER@$FEEDER_HOST:$REMOTE_DIR/"`
- [ ] 2.5 Feeder-local live-feed symlink (design.md Decision 6): over SSH, resolve the decoder source directory by:
  1. Reading `/etc/default/tar1090_instances` if it exists (format: `<srcdir> <instance-name>` per line; use the first entry, or the one matching instance name `tar1090` if multiple)
  2. Else probing, in order, `/run/dump1090-fa`, `/run/readsb`, `/run/adsbexchange-feed`, `/run/dump1090`, `/run/dump1090-mutability`, `/run/skyaware978`, `/run/shm` for an `aircraft.json` file present (mirrors tar1090's own `install.sh` probe order exactly)
  3. If found: `ln -sfn "<detected-srcdir>/aircraft.json" "$REMOTE_DIR/data/aircraft.json"` (run this **after** the rsync in 2.4, since `--delete` would otherwise remove a previously-created symlink not present in the local `out/` payload)
  4. If not found: log a clear warning ("no decoder aircraft.json found — aircraft layer will stay empty until one is available") and continue the deploy rather than failing it
- [ ] 2.6 Render `scripts/squawkmap3d.service.template` (task 3) with `$REMOTE_DIR`/`$FEEDER_PORT`/`$SERVICE_NAME` substituted, and `rsync`/`scp` the rendered unit to `$FEEDER_USER@$FEEDER_HOST:/etc/systemd/system/$SERVICE_NAME.service`
- [ ] 2.7 Over SSH, run: `systemctl daemon-reload && systemctl enable "$SERVICE_NAME" && systemctl restart "$SERVICE_NAME"` (explicit `restart`, not just `enable --now`, so an already-running service definitely picks up the new deploy)
- [ ] 2.8 Health check: poll `http://$FEEDER_HOST:$FEEDER_PORT/api/health` (from the local machine, over the real network path) a bounded number of times with a short delay between attempts, checking for valid JSON with `"status":"ok"` (not checking `timestamp` freshness — see design.md Decision 1/5); on success print a confirmation with the URL; on exhausting retries, print the last response/error and `exit 1` (see spec.md "Deploy verifies the deployed service is healthy before succeeding")
- [ ] 2.9 Make the script executable (`chmod +x scripts/deploy-to-feeder.sh`) and add a `deploy:feeder` script to `package.json` (`"deploy:feeder": "bash scripts/deploy-to-feeder.sh"`) for discoverability alongside the existing `dev`/`build`/`start` scripts

## 3. systemd unit template

- [ ] 3.1 Add `scripts/squawkmap3d.service.template` with placeholder tokens (e.g. `__REMOTE_DIR__`, `__PORT__`) for the deploy script to substitute:
  - `[Unit]`: `Description=SquawkMap3D`, `After=network.target`
  - `[Service]`: `WorkingDirectory=__REMOTE_DIR__`, `ExecStart=/usr/bin/env python3 -m http.server __PORT__ --directory __REMOTE_DIR__ --bind 0.0.0.0`, `Restart=on-failure`, `RestartSec=5`
  - `[Install]`: `WantedBy=multi-user.target`
  - No `User=` line (runs as root, matching the only access this design has — see design.md Decision 4's documented trade-off)

## 4. Documentation

- [ ] 4.1 Add a "Deploying to the feeder" section to `README.md` covering: prerequisites (SSH key at `~/.ssh/adsb_feeder`, Python 3 already on the feeder box, local `.env.local` populated before deploying — with `NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json` recommended specifically for this deploy target so the aircraft layer reads the feeder's own decoder feed same-origin, per design.md Decision 6), the command (`npm run deploy:feeder` / `bash scripts/deploy-to-feeder.sh`), how the feeder-local live feed is wired up automatically (and what it means if the deploy log warns that no decoder feed was found), how to check logs (`ssh -i ~/.ssh/adsb_feeder root@adsb-feeder.local journalctl -u squawkmap3d -f`), and how to uninstall (`systemctl disable --now squawkmap3d && rm -rf /opt/squawkmap3d /etc/systemd/system/squawkmap3d.service` — explicitly noting tar1090 itself is untouched by both deploy and uninstall)

## 5. Verification

- [ ] 5.1 Run the deploy script end-to-end against the real feeder box; confirm it completes successfully and `curl http://adsb-feeder.local:7500/api/health` returns `{"status":"ok",...}`
- [ ] 5.2 Confirm `systemctl status squawkmap3d` on the feeder box shows `enabled` and `active (running)`
- [ ] 5.3 Confirm the feeder-local symlink resolved correctly: `ssh -i ~/.ssh/adsb_feeder root@adsb-feeder.local readlink /opt/squawkmap3d/data/aircraft.json` points at the same source tar1090 itself uses (cross-check against `/etc/default/tar1090_instances` or tar1090's own served `/tar1090/data/aircraft.json` content), and `curl http://adsb-feeder.local:7500/data/aircraft.json` returns live aircraft data matching what tar1090 shows at the same moment
- [ ] 5.4 Load `http://adsb-feeder.local:7500` in a browser once `plane-tracks-3d-layer` is merged and confirm live aircraft render, with no CORS errors in the console for the `/data/aircraft.json` fetch (same-origin, per design.md Decision 6) — if `plane-tracks-3d-layer` isn't merged yet when this is verified, defer this specific check and note it as pending
- [ ] 5.5 Manually kill the remote Python process (`ssh ... systemctl kill squawkmap3d` or `pkill -f http.server`) and confirm systemd restarts it automatically within a few seconds, and the health check passes again without re-running the deploy script
- [ ] 5.6 Reboot the feeder box and confirm the service comes back up on port 7500 without re-running the deploy script, and the `/data/aircraft.json` symlink still resolves correctly (it's an absolute-path symlink to a location the decoder itself creates at its own boot, so this should hold as long as the decoder starts before or independently of squawkmap3d's systemd unit — verify no ordering issue in practice)
- [ ] 5.7 Re-run the deploy script a second time against the same box (no local changes) and confirm it completes successfully (idempotent redeploy, including the symlink step not erroring on an already-existing symlink), then again after a trivial local code change and confirm the change is reflected on the feeder box
- [ ] 5.8 Run each preflight-failure path deliberately (rename the SSH key temporarily, point `FEEDER_HOST` at an unreachable host) and confirm the script aborts with the specific, actionable error described in spec.md, before making any remote change
- [ ] 5.9 Confirm no writes occurred to tar1090/readsb/lighttpd's own files: `git`-style diff isn't applicable remotely, but spot-check `/etc/default/tar1090_instances`, `/etc/lighttpd/conf-enabled/*tar1090*`, and tar1090's own service status are unchanged before/after a deploy
- [ ] 5.10 Run `npm run lint` and `npx tsc --noEmit` and confirm no regressions from the `next.config.js`/`app/api/health/route.ts` changes
