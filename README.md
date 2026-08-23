# SquawkMap3D
Squawk Map 3D

## Setup

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_MAPTILER_KEY` to a MapTiler API key (used for the light/dark base map style and terrain-DEM source). Get one free at https://cloud.maptiler.com/account/keys/.

Optionally set `NEXT_PUBLIC_FEEDER_URL` to your ADS-B feeder's `aircraft.json` endpoint (readsb/dump1090-fa/tar1090-compatible) to enable the aircraft tracks layer. Left unset, that layer stays off.

## Attribution

Aircraft icons under `public/aircraft-shapes/` are vendored from [AircraftShapesSVG](https://github.com/RexKramer1/AircraftShapesSVG) (GPL-3.0), keyed by ICAO type designator.

Fallback silhouettes under `public/aircraft-silhouettes/` are vendored from [pw-silhouettes](https://github.com/plane-watch/pw-silhouettes) (CC BY-NC-SA 4.0 — non-commercial), one per ADS-B emitter category, used when no type-specific icon exists.

Both are vendored (not live-fetched) via `scripts/vendor-aircraft-icons.mjs`; re-run it and commit the result to refresh either set. See each directory's own `LICENSE` file.

## Deploying to the feeder

`npm run deploy:feeder` (or `bash scripts/deploy-to-feeder.sh`) builds a static export of this app and ships it to an ADS-B feeder box running [wiedehopf/tar1090](https://github.com/wiedehopf/tar1090), serving it on port 7500 via the box's existing lighttpd — sideloaded alongside tar1090, without touching its config or availability, as a drop-in-parity viewer reading the same live decoder feed tar1090 reads.

**Prerequisites:**
- SSH key at `~/.ssh/adsb_feeder`, authorized for `root@adsb-feeder.local` (override via `FEEDER_SSH_KEY`/`FEEDER_USER`/`FEEDER_HOST` env vars)
- The feeder box already has lighttpd (standard for a tar1090 install) — the script checks this and fails clearly if not
- Local `.env.local` populated before deploying, since `NEXT_PUBLIC_*` values are baked in at build time. Set `NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json` specifically for this deploy target — a relative URL that resolves same-origin against wherever the app is actually served from, avoiding CORS/LAN-IP issues (see `openspec/changes/deploy-to-feeder/design.md` Decision 6)

**What it does:** builds locally (`npm run build`) → ships `out/` via `rsync` → auto-detects the feeder's decoder output and symlinks it into the deployed directory as `data/aircraft.json` (same mechanism tar1090's own installer uses to locate it) → installs a new lighttpd site config for port 7500 and reloads lighttpd → polls `/api/health` until it responds successfully.

**Logs:** `ssh -i ~/.ssh/adsb_feeder root@adsb-feeder.local journalctl -u lighttpd -f`

**Uninstall:** on the feeder box, remove `/etc/lighttpd/conf-enabled/98-squawkmap3d.conf` and its `conf-available` source, `rm -rf /opt/squawkmap3d`, then `systemctl reload lighttpd`. tar1090 itself is untouched by both deploy and uninstall.
