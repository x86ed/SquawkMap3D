## Why

SquawkMap3D currently only runs via `npm run dev` (Next's hot-reloading dev server) on a developer's own machine. There's no way to run it persistently anywhere else, including on the user's own ADS-B feeder box — the same box that runs tar1090 today, and that (once `plane-tracks-3d-layer` lands) will also be the source of the live aircraft feed this app displays. The user confirmed directly: a single script that deploys a **static frontend** build of this app onto that feeder box (`root@adsb-feeder.local`, SSH key `~/.ssh/adsb_feeder`) on port 7500, as a **drop-in sidecar meant to work as a replacement for tar1090** — parity on reading the same live decoder feed tar1090 reads, sideloaded alongside it (not uninstalling it), independent of `next dev` and independent of the deploying machine staying connected.

Live, read-only reconnaissance against the actual box (`ssh`, `curl`, `docker ps`) during drafting found it runs dirkhh's Docker-based "ADS-B Feeder Image" — not a manual lighttpd install, as an earlier draft of this change assumed. The design below reflects that real setup, not the earlier assumption; see `design.md` for the full correction.

This is deployment/ops tooling, not an app feature — kept as its own change, separate from `plane-tracks-3d-layer`'s artifacts, even though both target the same physical box and this change's tar1090-parity goal depends on that other change's aircraft layer.

## What Changes

- Add `output: "export"` to `next.config.js` and `export const dynamic = "force-static";` to `app/api/health/route.ts` — a literal static export (`next build` produces `out/`, plain HTML/CSS/JS/JSON, no Node/Next server process at all), matching the user's confirmed "static frontend." Verified locally that this builds and serves correctly; the one behavior change is `/api/health`'s timestamp being frozen at build time instead of live.
- Add `scripts/deploy-to-feeder.sh`: builds the app **locally** (`npm run build`, using the developer machine's own `.env.local` — required, since `NEXT_PUBLIC_*` vars are inlined into the client JS at build time), ships the resulting `out/` directory plus a `Dockerfile` to `root@adsb-feeder.local` via `rsync`, builds a minimal `nginx:alpine`-based image **on the box itself** (native `aarch64`, no cross-arch concern), and runs it as its own container (`docker run -d --restart unless-stopped -p 7500:80`) — the same pattern every other tool on this box already uses (piaware, dump978, skystats, ...), independent of the box's existing `docker compose` stack.
- **Feeder-local live data, parity with tar1090**: the box's `ultrafeeder` container already serves `aircraft.json` on its published port (8080) with `Access-Control-Allow-Origin: *` set (confirmed via `curl -I` against the real box) — a plain cross-origin browser fetch already works, no wiring needed. The build sets `NEXT_PUBLIC_FEEDER_URL=http://adsb-feeder.local:8080/data/aircraft.json` directly.
- Document the deploy workflow and its prerequisites (Docker already present on the feeder box; local `.env.local` populated before deploying) in `README.md`.
- No changes to any existing container or the box's managed `docker compose` stack — this deploy runs as its own independent sidecar container, and must not affect tar1090/ultrafeeder's availability.

## Capabilities

### New Capabilities
- `feeder-deployment`: ability to build a static-export SquawkMap3D bundle and ship/run it as an independent Docker container on port 7500 on the user's ADS-B feeder box, via a single locally-run script — configured for parity with tar1090's live-map role (reading the same live decoder feed, already CORS-enabled on this box), sideloaded alongside tar1090 without modifying its setup, its container, or the box's existing `docker compose` stack.

### Modified Capabilities
(none — additive; no existing app capability changes)

## Impact

- New files: `scripts/deploy-to-feeder.sh`, `scripts/Dockerfile.squawkmap3d`.
- `next.config.js`: add `output: "export"`. `app/api/health/route.ts`: add `export const dynamic = "force-static";`. `package.json`: `start` script updated to `npx serve@latest out` (required once `output: "export"` is set — `next start` no longer works, confirmed locally) and a new `deploy:feeder` script added.
- `README.md`: new "Deploying to the feeder" section, including the recommended `NEXT_PUBLIC_FEEDER_URL=http://adsb-feeder.local:8080/data/aircraft.json` value for this deploy target.
- No new npm dependencies (uses the local machine's `ssh`/`rsync`, both expected present on macOS/Linux dev machines).
- No new host-level runtime/process on the feeder box: the script checks that Docker is present (it already is) and fails with a clear message rather than attempting to install anything.
- **Read-only interaction with the existing feeder setup**: the deploy script only ever makes a plain HTTP fetch against the `ultrafeeder` container's already-published, already-CORS-enabled port — it never writes to any existing container's files/config, and runs its own container entirely independent of the box's managed `docker compose` stack. tar1090/ultrafeeder must remain fully functional through every deploy/redeploy/removal.
- Relationship to `plane-tracks-3d-layer` (in flight, not yet merged): that change's aircraft layer is what actually renders the feed this deploy points at via `NEXT_PUBLIC_FEEDER_URL`; this change supplies the deployment mechanism and the feed URL, not the rendering itself.
