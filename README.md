# SquawkMap3D
Squawk Map 3D

## Setup

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_MAPTILER_KEY` to a MapTiler API key (used for the light/dark base map style and terrain-DEM source). Get one free at https://cloud.maptiler.com/account/keys/.

Optionally set `NEXT_PUBLIC_FEEDER_URL` to your ADS-B feeder's `aircraft.json` endpoint (readsb/dump1090-fa/tar1090-compatible) to enable the aircraft tracks layer. Left unset, that layer stays off.

### adsb.win feeder UUID (aircraft stats)

To see your own adsb.win fleet-wide stats (unique registrations, flights captured, observed flight time, highest altitude, XP, and tier) for the selected aircraft's type in `PlaneCard`, enter your adsb.win feeder UUID directly in the app — the first time you select an aircraft, `PlaneCard`'s stat region shows a prompt with a field to paste it in. This is **not** an environment variable: the UUID is a real bearer credential for your adsb.win account, so it's stored only in your browser's `localStorage` (never baked into the compiled JS bundle, never committed to git, never sent anywhere but `app-api.adsb.win`'s `Authorization` header). See your feeder UUID on your adsb.win account/feeder page.

The XP progress-to-next-tier bar shown for a successful card is driven by a small default per-tier XP threshold table (`components/map/overlay/tierProgress.ts`) — adsb.win's API doesn't document real per-tier thresholds itself, but the values in this table are confirmed, tester-sourced real numbers (not placeholders).

## Attribution

Aircraft icons under `public/aircraft-shapes/` are vendored from [AircraftShapesSVG](https://github.com/RexKramer1/AircraftShapesSVG) (GPL-3.0), keyed by ICAO type designator.

Fallback silhouettes under `public/aircraft-silhouettes/` are vendored from [pw-silhouettes](https://github.com/plane-watch/pw-silhouettes) (CC BY-NC-SA 4.0 — non-commercial), one per ADS-B emitter category, used when no type-specific icon exists.

Both are vendored (not live-fetched) via `scripts/vendor-aircraft-icons.mjs`; re-run it and commit the result to refresh either set. See each directory's own `LICENSE` file.

## Deploying to the feeder

`npm run deploy:feeder` (or `bash scripts/deploy-to-feeder.sh`) builds a static export of this app and runs it as its own Docker sidecar container on the ADS-B feeder box, port 7500 — the same pattern every other tool on that box (tar1090/ultrafeeder, piaware, dump978, ...) already runs as, independent of the box's own `docker compose` stack. Reads the same live decoder feed tar1090 shows, as a drop-in-parity viewer alongside it.

**Prerequisites:**
- SSH key at `~/.ssh/adsb_feeder`, authorized for `root@adsb-feeder.local` (override via `FEEDER_SSH_KEY`/`FEEDER_USER`/`FEEDER_HOST` env vars)
- The feeder box already has Docker (it runs every existing feeder tool) — the script checks this and fails clearly if not
- Local `.env.local` populated before deploying, since `NEXT_PUBLIC_*` values are baked in at build time. Set `NEXT_PUBLIC_FEEDER_URL=http://adsb-feeder.local:8080/data/aircraft.json` — the feeder's `ultrafeeder` container already serves that endpoint with `Access-Control-Allow-Origin: *`, so a plain cross-origin fetch works with no extra wiring (see `openspec/changes/deploy-to-feeder/design.md` Decision 6)

**What it does:** builds locally (`npm run build`) → ships `out/` + a `Dockerfile` via `rsync`/`scp` → builds a minimal `nginx:alpine` image on the box itself (native arch, no cross-compilation) → runs it as its own container (`docker run -d --restart unless-stopped -p 7500:80`) → polls `/api/health` until it responds successfully.

**Logs:** `ssh -i ~/.ssh/adsb_feeder root@adsb-feeder.local docker logs -f squawkmap3d`

**Uninstall:** on the feeder box, `docker rm -f squawkmap3d && docker rmi squawkmap3d:latest`. Every other container, including tar1090/ultrafeeder, is untouched by both deploy and uninstall.
