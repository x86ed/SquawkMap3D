## Why

SquawkMap3D currently only runs via `npm run dev` (Next's hot-reloading dev server) on a developer's own machine. There's no way to run it persistently anywhere else, including on the user's own ADS-B feeder box — the same machine that runs [wiedehopf/tar1090](https://github.com/wiedehopf/tar1090) today, and that (once `plane-tracks-3d-layer` lands) will also be the source of the live aircraft feed this app displays. The user wants a single script that deploys a production build of this app onto that feeder box (`root@adsb-feeder.local`, SSH key `~/.ssh/adsb_feeder`) and keeps it running as a service on port 7500 — a **drop-in replacement for tar1090** as the thing they actually look at, reading the same live decoder feed tar1090 reads, independent of `next dev` and independent of the deploying machine staying connected.

This is deployment/ops tooling, not an app feature — kept as its own change, separate from `plane-tracks-3d-layer`'s artifacts, even though both target the same physical box and this change's "drop-in replacement" goal depends on that other change's aircraft layer.

## What Changes

- Add `output: "export"` to `next.config.js` and `export const dynamic = "force-static";` to `app/api/health/route.ts` — a literal static export, verified locally in this drafting session to build successfully and serve correctly (`npm run build` produces `out/`; `python3 -m http.server` correctly serves both the app shell and the one route handler in this codebase, `/api/health`, as a static file). Matches the user's own "published static version... not hot loaded" wording, and needs no Node.js runtime on the feeder box at all — see the linked design doc's Decision 1 for why static export is fully viable for this app (aircraft-data liveness never depended on this app's own server; it comes from a separate client-side fetch against the feeder's decoder, exactly like tar1090 itself).
- Add `scripts/deploy-to-feeder.sh`: builds the app **locally** (`npm run build`, using the developer machine's own `.env.local` — required, since `NEXT_PUBLIC_*` vars are inlined into the client JS at build time, not readable at runtime on the remote box), ships the resulting `out/` directory to `root@adsb-feeder.local` via `rsync` over the given SSH key, **auto-detects and symlinks the feeder's own live `aircraft.json`** (read from tar1090's own resolved decoder-source location — see below) into the deployed directory so it's served same-origin (no CORS, no tar1090 config changes), installs/refreshes a systemd unit, restarts the service, and verifies `GET /api/health` responds on port 7500 before exiting successfully.
- Add `scripts/squawkmap3d.service.template`: a systemd unit (`Restart=on-failure`, `WantedBy=multi-user.target` so it survives reboots) running `python3 -m http.server 7500` against the deployed static directory — no Node.js process, no application runtime, just a file server.
- **Feeder-local live data, drop-in with tar1090**: tar1090's own installer resolves its decoder's `aircraft.json` location (one of `/run/readsb`, `/run/dump1090-fa`, etc.) and records it in `/etc/default/tar1090_instances`; confirmed by reading tar1090's actual `install.sh`/`88-tar1090.conf` from its GitHub repo that tar1090's own `aircraft.json` is served **without** an `Access-Control-Allow-Origin` header, so fetching it cross-origin (SquawkMap3D on port 7500 vs. tar1090's own port) would fail under browser CORS. The deploy script sidesteps this entirely by reading that same resolved location and symlinking it into SquawkMap3D's own served directory (`<deploy-dir>/data/aircraft.json`), then building with `NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json` (a relative, same-origin URL) — no CORS, no LAN-IP hardcoding, and tar1090's own configuration is never modified, only read.
- Document the deploy workflow and its prerequisites (Python 3 already present on the feeder box — near-universal on Debian/Raspberry Pi OS; local `.env.local` populated before deploying) in `README.md`.
- No changes to any existing app/component code beyond the one-line static-export opt-in on the health route — purely additive ops tooling.

## Capabilities

### New Capabilities
- `feeder-deployment`: ability to build a static production (non-dev) SquawkMap3D bundle and ship/run it as a persistent, auto-restarting systemd-supervised static file server on port 7500 on the user's ADS-B feeder box, via a single locally-run script — configured as a drop-in replacement for tar1090's live-map role, reading the same local decoder feed tar1090 reads, same-origin, without modifying tar1090's own setup.

### Modified Capabilities
(none — additive; no existing app capability changes)

## Impact

- New files: `scripts/deploy-to-feeder.sh`, `scripts/squawkmap3d.service.template`.
- `next.config.js`: add `output: "export"`.
- `app/api/health/route.ts`: add `export const dynamic = "force-static";` (required for the route to build under static export; verified locally — without it, `next build` fails outright).
- `README.md`: new "Deploying to the feeder" section, including the recommended `NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json` value for this deploy target.
- No new npm dependencies (uses the local machine's `ssh`/`rsync`, both expected present on macOS/Linux dev machines; the remote box only needs `python3`, not Node.js).
- New operational prerequisite: Python 3 must already be present on the feeder box; the script checks for this and fails with a clear message rather than attempting to install it.
- **Read-only interaction with the existing tar1090 install**: the deploy script inspects (via SSH) `/etc/default/tar1090_instances` and, as a fallback, the same `/run/*/aircraft.json` probe order tar1090's own installer uses, to locate the live decoder feed — it never writes to tar1090/readsb/lighttpd's own files, config, or services.
- **Behavior change**: `/api/health`'s `timestamp` field is now frozen at build/deploy time rather than reflecting live request time (an accepted consequence of static export — see design.md Decision 1/Risks).
- Relationship to `plane-tracks-3d-layer` (in flight, not yet merged): that change's aircraft layer is what actually renders the feed this deploy wires up via `NEXT_PUBLIC_FEEDER_URL=/data/aircraft.json`; this change supplies the deployment mechanism and the feeder-local, same-origin data wiring, not the rendering itself.
