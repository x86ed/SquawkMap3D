## Why

SquawkMap3D currently only runs via `npm run dev` (Next's hot-reloading dev server) on a developer's own machine. There's no way to run it persistently anywhere else, including on the user's own ADS-B feeder box — the same machine that runs [wiedehopf/tar1090](https://github.com/wiedehopf/tar1090) today, and that (once `plane-tracks-3d-layer` lands) will also be the source of the live aircraft feed this app displays. The user confirmed directly: a single script that deploys a **static frontend** build of this app onto that feeder box (`root@adsb-feeder.local`, SSH key `~/.ssh/adsb_feeder`) on port 7500, as a **drop-in sidecar meant to work as a replacement for tar1090** — parity on reading the same live decoder feed tar1090 reads, sideloaded alongside it (not uninstalling it), independent of `next dev` and independent of the deploying machine staying connected.

This is deployment/ops tooling, not an app feature — kept as its own change, separate from `plane-tracks-3d-layer`'s artifacts, even though both target the same physical box and this change's tar1090-parity goal depends on that other change's aircraft layer.

## What Changes

- Add `output: "export"` to `next.config.js` and `export const dynamic = "force-static";` to `app/api/health/route.ts` — a literal static export (`next build` produces `out/`, plain HTML/CSS/JS/JSON, no Node/Next server process at all), matching the user's confirmed "static frontend." Verified locally during drafting that this builds and serves correctly; the one behavior change is `/api/health`'s timestamp being frozen at build time instead of live.
- Add `scripts/deploy-to-feeder.sh`: builds the app **locally** (`npm run build`, using the developer machine's own `.env.local` — required, since `NEXT_PUBLIC_*` vars are inlined into the client JS at build time), ships the resulting `out/` directory to `root@adsb-feeder.local` via `rsync` over the given SSH key, **auto-detects and symlinks the feeder's own live `aircraft.json`** (read from tar1090's own resolved decoder-source location) into the deployed directory so it's served same-origin (no CORS, no tar1090 config changes), installs/refreshes a new lighttpd site config for port 7500, reloads lighttpd (the box's existing, tar1090-dependency web server — no new process, no new runtime), and verifies `GET /api/health` responds on port 7500 before exiting successfully.
- Add `scripts/squawkmap3d.lighttpd.conf.template`: a lighttpd site config (`server.port = 7500`, document root the deployed `out/` directory) that the deploy script renders and installs alongside tar1090's own site config, without editing it.
- **Feeder-local live data, parity with tar1090**: tar1090's own installer resolves its decoder's `aircraft.json` location (one of `/run/readsb`, `/run/dump1090-fa`, etc.) and records it in `/etc/default/tar1090_instances`; confirmed by reading tar1090's actual `install.sh`/`88-tar1090.conf` from its GitHub repo that tar1090's own `aircraft.json` is served **without** an `Access-Control-Allow-Origin` header, so fetching it cross-origin (SquawkMap3D on port 7500 vs. tar1090's own port) would fail under browser CORS. The deploy script sidesteps this entirely by reading that same resolved location and symlinking it into SquawkMap3D's own served directory (`<deploy-dir>/data/aircraft.json`), then building with `NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json` (a relative, same-origin URL) — no CORS, no LAN-IP hardcoding, and tar1090's own configuration is never modified, only read.
- Document the deploy workflow and its prerequisites (lighttpd already present on the feeder box, per its tar1090 install; local `.env.local` populated before deploying) in `README.md`.
- No changes to tar1090's own configuration — this deploy runs *alongside* tar1090, sideloaded, and must not affect its availability.

## Capabilities

### New Capabilities
- `feeder-deployment`: ability to build a static-export SquawkMap3D bundle and ship/serve it via a new lighttpd site config on port 7500 on the user's ADS-B feeder box, via a single locally-run script — configured for parity with tar1090's live-map role (reading the same local decoder feed tar1090 reads, same-origin), sideloaded alongside tar1090 without modifying its setup or availability, and without any new runtime/process on the box.

### Modified Capabilities
(none — additive; no existing app capability changes)

## Impact

- New files: `scripts/deploy-to-feeder.sh`, `scripts/squawkmap3d.lighttpd.conf.template`.
- `next.config.js`: add `output: "export"`. `app/api/health/route.ts`: add `export const dynamic = "force-static";`.
- `README.md`: new "Deploying to the feeder" section, including the recommended `NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json` value for this deploy target.
- No new npm dependencies (uses the local machine's `ssh`/`rsync`, both expected present on macOS/Linux dev machines).
- No new runtime/process on the feeder box: the script checks that lighttpd (already required for tar1090) and its systemd unit are present, and fails with a clear message rather than attempting to install anything.
- **Read-only interaction with the existing tar1090 install, one new sibling config file**: the deploy script inspects (via SSH) `/etc/default/tar1090_instances` and, as a fallback, the same `/run/*/aircraft.json` probe order tar1090's own installer uses, to locate the live decoder feed — it never writes to tar1090's own files/config, only adds its own separate lighttpd site config and reloads the shared lighttpd process (the same graceful operation tar1090's own installer performs). tar1090 must remain fully functional through every deploy/redeploy/removal.
- Relationship to `plane-tracks-3d-layer` (in flight, not yet merged): that change's aircraft layer is what actually renders the feed this deploy wires up via `NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json`; this change supplies the deployment mechanism and the feeder-local, same-origin data wiring, not the rendering itself.
