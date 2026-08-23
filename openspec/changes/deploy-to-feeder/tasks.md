## 1. Static export config

- [x] 1.1 In `next.config.js`, add `output: "export"` to `nextConfig`
- [x] 1.2 In `app/api/health/route.ts`, add `export const dynamic = "force-static";` (required for the route to be includable in a static export — see design.md Decision 1; its `timestamp` becomes build time, not request time)
- [x] 1.3 Run `npm run build` locally and confirm `out/` is produced, containing the app shell, all JS/CSS/vendored assets, and `out/api/health` — confirmed (`out/` present, `out/data/{airports,military-bases}.geojson` present, `out/api/health` a plain file with the correct frozen JSON). **Side effect discovered and fixed**: `output: "export"` breaks `next start` (`"next start" does not work with 'output: export' configuration"`) — `package.json`'s `start` script updated to `npx serve@latest out` (Next's own suggested replacement); see design.md's new Risk entry
- [x] 1.4 Serve `out/` locally with any static file server and confirm `/` loads with no console errors and `GET /api/health` returns the expected JSON body — confirmed via `python3 -m http.server` (`/` → 200, `/api/health` → 200 with correct body)

## 2. Deploy script: build, ship, and feeder-local live-feed wiring

- [x] 2.1 Add `scripts/deploy-to-feeder.sh` (bash, `set -euo pipefail`) with configurable-via-env-var, defaulted settings: `FEEDER_HOST` (default `adsb-feeder.local`), `FEEDER_USER` (default `root`), `FEEDER_SSH_KEY` (default `~/.ssh/adsb_feeder`), `FEEDER_PORT` (default `7500`), `REMOTE_DIR` (default `/opt/squawkmap3d`), `SITE_CONF_NAME` (default `98-squawkmap3d.conf`)
- [x] 2.2 Preflight checks implemented (rsync/ssh present, SSH key exists, feeder reachable, remote lighttpd present + systemd-managed, `.env.local`/`NEXT_PUBLIC_FEEDER_URL` warnings) — see spec.md "Deploy script fails fast on missing prerequisites"
- [x] 2.3 Build: `npm run build` invoked from the script, producing `out/`
- [x] 2.4 Ship the payload via `rsync -az --delete`
- [x] 2.5 Feeder-local live-feed symlink implemented per design.md Decision 6 (tar1090_instances → probe-order fallback → `ln -sfn` → non-fatal warning if not found)
- [x] 2.6 Renders `scripts/squawkmap3d.lighttpd.conf.template` and ships it via `scp` to `conf-available/`
- [x] 2.7 Symlinks into `conf-enabled/`, validates with `lighttpd -tt`, reloads (not restarts) lighttpd
- [x] 2.8 Health check polls `/api/health`, bounded retries, `exit 1` with last response on failure
- [x] 2.9 Script made executable; `deploy:feeder` added to `package.json`
- [ ] **Not yet exercised against the real box** — script is written, syntax-checked (`bash -n`), and its logic reviewed, but no task in this group 2 has been run against `root@adsb-feeder.local` (that's group 5, Verification, deliberately deferred — see its own note)

## 3. lighttpd site config template

- [x] 3.1 Added `scripts/squawkmap3d.lighttpd.conf.template` — **structure differs from this task's original literal wording**: rather than top-level `server.port`/`mimetype.assign` directives, it uses a `$SERVER["socket"] == ":__PORT__" { server.document-root = "__REMOTE_DIR__" ... }` conditional block, matching the actual pattern tar1090's own `install.sh` generates for its `95-tar1090-otherport.conf` (confirmed by fetching and reading that generation logic directly, not guessed) — this is the correct idiom for binding an additional port on the same lighttpd instance without a full second `server.port` top-level override, and reuses the box's already-loaded default mimetype module rather than redeclaring one
- [x] 3.2 Confirmed against tar1090's real `88-tar1090.conf`/`install.sh` (fetched from its GitHub repo during this session) — not guessed

## 4. Documentation

- [x] 4.1 Added "Deploying to the feeder" section to `README.md` covering prerequisites, the command, what the script does, log location, and uninstall steps

## 5. Verification

**This is a sideloaded, parallel deployment for testing — tar1090 ("the original map") must keep working, unaffected, throughout. Confirm this explicitly, not just assume it:**

- [ ] 5.0 Before the first deploy, record a baseline: confirm tar1090 is currently reachable and working normally (whatever URL/port it's already served on), so later steps have something concrete to compare against
- [ ] 5.1 Run the deploy script end-to-end against the real feeder box; confirm it completes successfully and `curl http://adsb-feeder.local:7500/api/health` returns `{"status":"ok",...}`
- [ ] 5.2 Confirm `systemctl status lighttpd` on the feeder box shows `active (running)` and the new site config is loaded (`lighttpd -tt -f /etc/lighttpd/lighttpd.conf` reports it enabled)
- [ ] 5.3 Confirm the feeder-local symlink resolved correctly: `ssh -i ~/.ssh/adsb_feeder root@adsb-feeder.local readlink /opt/squawkmap3d/data/aircraft.json` points at the same source tar1090 itself uses (cross-check against `/etc/default/tar1090_instances` or tar1090's own served `/tar1090/data/aircraft.json` content), and `curl http://adsb-feeder.local:7500/data/aircraft.json` returns live aircraft data matching what tar1090 shows at the same moment
- [ ] 5.4 Load `http://adsb-feeder.local:7500` in a browser once `plane-tracks-3d-layer` is merged and confirm live aircraft render, with no CORS errors in the console for the `/data/aircraft.json` fetch (same-origin, per design.md Decision 6) — if `plane-tracks-3d-layer` isn't merged yet when this is verified, defer this specific check and note it as pending
- [ ] 5.5 Reboot the feeder box and confirm lighttpd (and this app's site alongside it) comes back up on port 7500 without re-running the deploy script, and the `/data/aircraft.json` symlink still resolves correctly (it's an absolute-path symlink to a location the decoder itself creates at its own boot — verify no ordering issue between lighttpd starting and the decoder having created its output yet; a dangling symlink at boot should not crash anything, just make `/data/aircraft.json` 404 until the decoder catches up)
- [ ] 5.6 Re-run the deploy script a second time against the same box (no local changes) and confirm it completes successfully (idempotent redeploy, including the symlink and lighttpd-site steps not erroring on already-existing state), then again after a trivial local code change and confirm the change is reflected on the feeder box
- [ ] 5.7 Run each preflight-failure path deliberately (rename the SSH key temporarily, point `FEEDER_HOST` at an unreachable host) and confirm the script aborts with the specific, actionable error described in spec.md, before making any remote change
- [ ] 5.8 Confirm tar1090 is unaffected, both at the config level and functionally: spot-check `/etc/default/tar1090_instances` and tar1090's own `/etc/lighttpd/conf-enabled/*tar1090*` file are byte-for-byte unchanged before/after a deploy, **and** re-load tar1090 in a browser (its original URL/port from the 5.0 baseline) and confirm it still works normally — same check repeated after removing the deployed app per the uninstall steps (task 4.1), confirming tar1090 is unaffected by removal too
- [x] 5.9 Run `npm run lint` and `npx tsc --noEmit` and confirm no regressions from the `next.config.js`/health-route changes — both clean; `npm test` also re-confirmed 7/7 passing
