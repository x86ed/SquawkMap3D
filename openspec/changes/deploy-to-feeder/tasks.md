## 1. Confirm the "static / not hot loaded" reading before building

- [ ] 1.1 Confirm with the user (or Janus, on their behalf) that "published static version... not hot loaded" means a production `next build` + standalone `server.js` (not `next dev`) — **not** a literal `next export`/`output: "export"` static-HTML export — per design.md Decision 1 and its Open Question. Do not proceed past this task until confirmed; if the user actually wants a literal static export, design.md needs to be revised first (different serving mechanism, loses `/api/health`'s live behavior).

## 2. Next.js config for minimal-footprint production output

- [ ] 2.1 In `next.config.js`, add `output: "standalone"` to `nextConfig`
- [ ] 2.2 Run `npm run build` locally and confirm `.next/standalone/server.js` is produced; confirm `node .next/standalone/server.js` (after manually copying `public/` and `.next/static/` into `.next/standalone/` per Next's documented standalone steps) serves the app locally on its default port with no console errors
- [ ] 2.3 Confirm `GET /api/health` still returns a live (non-frozen) timestamp when served from the standalone `server.js`, not a build-time-frozen value

## 3. Deploy script

- [ ] 3.1 Add `scripts/deploy-to-feeder.sh` (bash, `set -euo pipefail`) with configurable-via-env-var, defaulted settings: `FEEDER_HOST` (default `adsb-feeder.local`), `FEEDER_USER` (default `root`), `FEEDER_SSH_KEY` (default `~/.ssh/adsb_feeder`), `FEEDER_PORT` (default `7500`), `REMOTE_DIR` (default `/opt/squawkmap3d`), `SERVICE_NAME` (default `squawkmap3d`)
- [ ] 3.2 Preflight checks (abort with a specific error, before any remote/destructive action, on failure — see spec.md "Deploy script fails fast on missing prerequisites"):
  - `rsync` and `ssh` are available locally
  - the SSH key at `$FEEDER_SSH_KEY` exists
  - `ssh -i "$FEEDER_SSH_KEY" "$FEEDER_USER@$FEEDER_HOST" true` succeeds (feeder reachable)
  - remote `node --version` is present and satisfies Next's minimum (`>=20.9.0`, per `node_modules/next/package.json`'s `engines.node` — read this from the local `node_modules/next/package.json` at script run time rather than hardcoding, so it stays correct if the Next dependency is upgraded later)
  - warn (non-fatal) if local `.env.local`/`.env.production.local` is missing or has no `NEXT_PUBLIC_MAPTILER_KEY` set, since `NEXT_PUBLIC_*` values are baked in at this build step (design.md Decision 3) — proceeding without one produces a build the map won't render correctly, but that's a user config issue, not a reason to hard-block the script
- [ ] 3.3 Build: run `npm run build` in the repo root (uses whatever local `.env.local`/`.env.production.local` is present)
- [ ] 3.4 Assemble a deploy payload in a `mktemp -d` staging directory (cleaned up via `trap ... EXIT`): copy `.next/standalone/*` to the staging root, then `public/` and `.next/static/` into it, matching Next's documented standalone-output copy steps (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`)
- [ ] 3.5 Ship the payload: `rsync -az --delete -e "ssh -i \"$FEEDER_SSH_KEY\"" <staging>/ "$FEEDER_USER@$FEEDER_HOST:$REMOTE_DIR/"`
- [ ] 3.6 Render `scripts/squawkmap3d.service.template` (task 4) with `$REMOTE_DIR`/`$FEEDER_PORT`/`$SERVICE_NAME` substituted, and `rsync`/`scp` the rendered unit to `$FEEDER_USER@$FEEDER_HOST:/etc/systemd/system/$SERVICE_NAME.service`
- [ ] 3.7 Over SSH, run: `systemctl daemon-reload && systemctl enable "$SERVICE_NAME" && systemctl restart "$SERVICE_NAME"` (explicit `restart`, not just `enable --now`, so an already-running service actually picks up the new build — see design.md Decision 4)
- [ ] 3.8 Health check: poll `http://$FEEDER_HOST:$FEEDER_PORT/api/health` (from the local machine, over the real network path) a bounded number of times with a short delay between attempts; on success print a confirmation with the URL; on exhausting retries, print the last response/error and `exit 1` (see spec.md "Deploy verifies the deployed service is healthy before succeeding")
- [ ] 3.9 Make the script executable (`chmod +x scripts/deploy-to-feeder.sh`) and add a `deploy:feeder` script to `package.json` (`"deploy:feeder": "bash scripts/deploy-to-feeder.sh"`) for discoverability alongside the existing `dev`/`build`/`start` scripts

## 4. systemd unit template

- [ ] 4.1 Add `scripts/squawkmap3d.service.template` with placeholder tokens (e.g. `__REMOTE_DIR__`, `__PORT__`) for the deploy script to substitute:
  - `[Unit]`: `Description=SquawkMap3D`, `After=network.target`
  - `[Service]`: `WorkingDirectory=__REMOTE_DIR__`, `ExecStart=/usr/bin/env node __REMOTE_DIR__/server.js`, `Environment=PORT=__PORT__`, `Environment=HOSTNAME=0.0.0.0`, `Restart=on-failure`, `RestartSec=5`
  - `[Install]`: `WantedBy=multi-user.target`
  - No `User=` line (runs as root, matching the only access this design has — see design.md Decision 4's documented trade-off)

## 5. Documentation

- [ ] 5.1 Add a "Deploying to the feeder" section to `README.md` covering: prerequisites (SSH key at `~/.ssh/adsb_feeder`, Node.js `>=20.9` already installed on the feeder box, local `.env.local` populated before deploying since env vars are baked in at build time — link to design.md Decision 3's caveat about `NEXT_PUBLIC_FEEDER_URL` needing a rebuild+redeploy to change), the command (`npm run deploy:feeder` / `bash scripts/deploy-to-feeder.sh`), how to check logs (`ssh -i ~/.ssh/adsb_feeder root@adsb-feeder.local journalctl -u squawkmap3d -f`), and how to uninstall (`systemctl disable --now squawkmap3d && rm -rf /opt/squawkmap3d /etc/systemd/system/squawkmap3d.service`)

## 6. Verification

- [ ] 6.1 Run the deploy script end-to-end against the real feeder box; confirm it completes successfully and `curl http://adsb-feeder.local:7500/api/health` returns `{"status":"ok",...}` with a current timestamp
- [ ] 6.2 Confirm `systemctl status squawkmap3d` on the feeder box shows `enabled` and `active (running)`
- [ ] 6.3 Manually kill the remote Node process (`ssh ... systemctl kill squawkmap3d` or `pkill -f server.js`) and confirm systemd restarts it automatically within a few seconds, and the health check passes again without re-running the deploy script
- [ ] 6.4 Reboot the feeder box (or simulate via `systemctl stop` + confirming `enabled` status implies boot-start) and confirm the service comes back up on port 7500 without re-running the deploy script
- [ ] 6.5 Re-run the deploy script a second time against the same box (no local changes) and confirm it completes successfully (idempotent redeploy), then again after a trivial local code change and confirm the change is reflected on the feeder box
- [ ] 6.6 Run each preflight-failure path deliberately (rename the SSH key temporarily, point `FEEDER_HOST` at an unreachable host) and confirm the script aborts with the specific, actionable error described in spec.md, before making any remote change
- [ ] 6.7 Run `npm run lint` and `npx tsc --noEmit` and confirm no regressions from the `next.config.js` change
