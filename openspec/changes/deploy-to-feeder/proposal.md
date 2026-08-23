## Why

SquawkMap3D currently only runs via `npm run dev` (Next's hot-reloading dev server) on a developer's own machine. There's no way to run it persistently anywhere else, including on the user's own ADS-B feeder box — the machine that (once `plane-tracks-3d-layer` lands) will also be the source of the live aircraft feed this app displays. The user wants a single script that deploys a production build of this app onto that feeder box (`root@adsb-feeder.local`, SSH key `~/.ssh/adsb_feeder`) and keeps it running as a service on port 7500, independent of `next dev` and independent of the deploying machine staying connected.

This is deployment/ops tooling, not an app feature — kept as its own change, separate from `plane-tracks-3d-layer`'s artifacts, even though both target the same physical box.

## What Changes

- Add `output: "standalone"` to `next.config.js` — Next's documented low-footprint self-host output: `next build` traces and copies only the files actually needed to run (`.next/standalone/server.js` + a pruned `node_modules`), so the feeder box doesn't need `node_modules` installed or a full `npm install`/build toolchain run on it.
- Add `scripts/deploy-to-feeder.sh`: builds the app **locally** (`npm run build`, using the developer machine's own `.env.local`/`.env.production.local` — required, since `NEXT_PUBLIC_*` vars are inlined into the client JS at build time, not readable at runtime on the remote box), assembles the standalone output + `public/` + `.next/static/` into a deploy payload, ships it to `root@adsb-feeder.local` via `rsync` over the given SSH key, installs/refreshes a systemd unit, restarts the service, and verifies `GET /api/health` responds on port 7500 before exiting successfully.
- Add `scripts/squawkmap3d.service.template`: a systemd unit (`Restart=on-failure`, `WantedBy=multi-user.target` so it survives reboots, `PORT=7500`/`HOSTNAME=0.0.0.0`) that the deploy script renders and installs to `/etc/systemd/system/squawkmap3d.service` on the remote box.
- Document the deploy workflow and its prerequisites (Node.js ≥20.9 already installed on the feeder box; local `.env.local` populated before deploying) in `README.md`.
- No changes to any existing app/component code — purely additive ops tooling plus one `next.config.js` line.

## Capabilities

### New Capabilities
- `feeder-deployment`: ability to build a production (non-dev) SquawkMap3D bundle and ship/run it as a persistent, auto-restarting systemd service on port 7500 on the user's ADS-B feeder box, via a single locally-run script.

### Modified Capabilities
(none — additive; no existing app capability changes)

## Impact

- New files: `scripts/deploy-to-feeder.sh`, `scripts/squawkmap3d.service.template`.
- `next.config.js`: add `output: "standalone"`.
- `README.md`: new "Deploying to the feeder" section.
- No new npm dependencies (uses the local machine's `ssh`/`rsync`, both expected present on macOS/Linux dev machines).
- New operational prerequisite: Node.js ≥20.9 (Next 16's `engines.node` floor) must already be installed on the feeder box; the script checks for this and fails with clear instructions rather than attempting to install it.
- Relationship to `plane-tracks-3d-layer` (in flight, not yet merged): once this app runs on the feeder box itself, `NEXT_PUBLIC_FEEDER_URL` can point at that box's own `aircraft.json` endpoint (e.g. `http://localhost:8080/data/aircraft.json`) instead of crossing the LAN — an operational config choice for whoever sets `.env.local` before running the deploy script, not something this change needs to implement.
