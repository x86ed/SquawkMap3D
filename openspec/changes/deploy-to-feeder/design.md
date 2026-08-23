## Context

SquawkMap3D (Next.js 16 App Router, React 19) has one server-side piece — `app/api/health/route.ts`, a plain dynamic `GET` returning a live timestamp — and is otherwise a client-rendered MapLibre/deck.gl app. It has never been deployed anywhere but a developer's own `next dev`. The user wants it running persistently on their ADS-B feeder box: `root@adsb-feeder.local`, SSH key `~/.ssh/adsb_feeder`, port 7500, "a published static version of the codebase, not hot loaded," driven by a script.

Feeder boxes in this ecosystem (tar1090/readsb/ultrafeeder-style setups) are typically resource-constrained single-board computers (Raspberry Pi class) whose primary job is decoding ADS-B data — not compiling TypeScript/webpack bundles.

## Goals / Non-Goals

**Goals:**
- One script, run from a developer machine, that takes the current working tree to a running, auto-restarting service on `adsb-feeder.local:7500`.
- The deployed process is a genuine production build — no dev-server hot-reload/watch behavior, no on-box compilation.
- Survives reboots and crashes on the feeder box without manual intervention (systemd).
- Safe to re-run repeatedly for redeploys (idempotent).
- Script fails loudly and specifically on missing prerequisites (SSH key, unreachable host, remote Node too old/missing) rather than leaving a half-deployed state silently.

**Non-Goals:**
- Zero-downtime/blue-green releases, release history, or rollback tooling — single personal feeder, single service, a few seconds of restart downtime is acceptable.
- Fleet/multi-target deployment, CI/CD pipeline integration, or a deploy UI — this is a manually-invoked personal script.
- Installing Node.js itself on the remote box, or managing the feeder's other software (readsb, tar1090, etc.) — out of scope; the script only manages this app's own service.
- HTTPS/TLS termination or a reverse proxy in front of port 7500 — the user asked for the service to run on port 7500 directly; a reverse proxy can be layered on separately later if wanted.

## Decisions

### 1. "Published static version... not hot loaded" — static export vs. standalone Node server (open, narrower than first framed)

This is the one genuinely ambiguous piece of the request. First pass in this drafting session (no clarifying-question tool available at the time) concluded standalone Node server, reasoning that static export would freeze `/api/health`'s live timestamp and that the app's whole point — live aircraft data — needed a server. **That second reason doesn't hold up and has been corrected**, narrowing the actual trade-off considerably:

- **Aircraft-data liveness does not depend on this app's server at all, static or not.** The in-flight `plane-tracks-3d-layer` change's own design.md (Decision 3) fetches `aircraft.json` directly from the browser against `NEXT_PUBLIC_FEEDER_URL` — a separate, always-running service (the feeder box's own readsb/dump1090-fa decoder) — explicitly "mirrors how tar1090 itself works (browser fetches its own decoder's JSON directly)." tar1090's own apparent "active server component" is that same pattern: its web UI is static HTML/CSS/JS, and the liveness comes from a client-side poll against a JSON file a *separate* decoder process continuously rewrites, served by a plain static file server (lighttpd in the standard tar1090 setup) — not from tar1090 running a dynamic app server. So whether SquawkMap3D itself is served statically or by a Node process has no bearing on whether aircraft data displays live.
- **What static export actually costs is narrower**: just `app/api/health/route.ts`, the one genuinely per-request-dynamic route in this codebase (`new Date().toISOString()`). Under `output: "export"` that route freezes to a build-time value; Next's own docs (`node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md`) list static export as **"Limited"** feature support for exactly this class of thing. Everything else in the app (map, layers, aircraft polling) is already 100% client-rendered and works identically either way.
- Given that, this is a live, unresolved fork rather than a settled decision — captured in Open Questions below for the user to choose, since both readings are now legitimately defensible:
  - **(A) Static export** (`output: "export"`, served by any lightweight static file server on port 7500 — nginx, `serve`, etc.): the more literal reading of "static," and simpler ops — **no Node runtime needed on the feeder box at all**, no remote Node-version preflight, systemd supervises a static file server instead of a `node server.js` process. Cost: `/api/health` can no longer report true liveness (the deploy script's health check would need to become "does the static bundle's index page load" rather than "is the app process currently alive"), and any future server-side route would require redoing this deploy mechanism (Next's static export explicitly doesn't support server-dependent features).
  - **(B) Standalone Node server** (`output: "standalone"`, as drafted through the rest of this document): still a real precompiled production build, still satisfies "not hot loaded" (no file-watching/HMR), keeps `/api/health` genuinely live, and keeps headroom for any future server route with zero deploy-mechanism rework. Cost: needs Node ≥20.9 already on the feeder box, and systemd supervises an actual long-running process rather than just files.
- The rest of this document (Decisions 2-5, tasks.md, spec.md) is written against **(B)**, since it was the working assumption when drafted, but every piece of it — the `output` config line, the deploy script's payload assembly, the systemd unit, the health-check mechanism — would need revision if the user picks **(A)**. Do not implement until this is resolved (see Open Questions).

### 2. Build locally; ship a pre-built payload, not source-to-build-on-box

Two options considered:
- **(Chosen) Build on the developer's machine, ship compiled output.** `output: "standalone"` traces and copies only the files the server actually needs (server.js + a pruned `node_modules`) — the feeder box never runs `npm install`, `tsc`, or a bundler. This matters because feeder SBCs are typically busy decoding ADS-B data and are not sized for a Next.js/webpack build; it also matches the user's "published static version" framing directly (ship a finished artifact, don't build in place).
- **Rejected: `git pull` + `npm ci` + `npm run build` on the box.** Simpler to reason about (no cross-machine artifact assembly) but puts the full build toolchain (TypeScript, ESLint deps, webpack) and the resource cost of a full build on constrained hardware, competing with the feeder's actual job. Also requires devDependencies and the whole repo (including anything not meant to ship) present on a box the deploy script doesn't otherwise need write access to beyond its own app directory.
- Cross-architecture risk of shipping locally-built output was checked, not assumed: this app does not use `next/image` anywhere (`grep -rn "next/image" app components` — no matches) and the only native (`.node`) addon in `node_modules` is `fsevents` (macOS-only, a dev-time `chokidar` dependency, never traced into the standalone server output). So the standalone payload is pure JS/JSON/assets — safe to build on a macOS dev machine and run on the feeder's Linux/ARM box. If `next/image` optimization (which depends on the native `sharp` binary) is ever adopted, this decision must be revisited (cross-compile or build-on-box for that native dependency).

### 3. `NEXT_PUBLIC_*` env vars come from the local build machine, not the remote box

Next.js inlines `NEXT_PUBLIC_*` variables into the client JS bundle at `next build` time (confirmed in `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`: *"these public environment variables will be inlined into the JavaScript bundle during `next build`"*). Since this design builds locally (Decision 2), the values already come from wherever `npm run build` runs — the developer's own `.env.local`/`.env.production.local`, exactly like local dev already works. No new remote env-file deployment or systemd `Environment=` plumbing is needed for `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_OPENAIP_API_KEY`, or `NEXT_PUBLIC_FEEDER_URL` — confirmed via `grep -rn "process.env" components/` that all three of this app's env vars are `NEXT_PUBLIC_*`-prefixed and read only in browser-facing code; there are no private server-only env vars anywhere in the codebase today. The deploy script only needs `PORT`/`HOSTNAME` as true remote-runtime env vars (set in the systemd unit), which control the standalone server's bind address/port, not app behavior.
- **Caveat surfaced for the user**: if they intend to point `NEXT_PUBLIC_FEEDER_URL` at the feeder's own local `aircraft.json` once this app runs on that same box, that value must be set in the *local* `.env.local` used at `npm run build` time before running the deploy script — it cannot be changed later by editing anything on the remote box; a redeploy (rebuild + re-run the script) is required to change it. Documented in `README.md`.

### 4. Process supervision: systemd unit, root-owned, single stable directory

- systemd is the natural fit for a root-accessible Debian/Raspberry-Pi-OS-class Linux box: `Restart=on-failure` for crash recovery, `WantedBy=multi-user.target` + `systemctl enable` for boot persistence, `journalctl -u squawkmap3d` for logs — no extra runtime dependency (unlike pm2/forever, which would need installing on the box).
- The unit runs as root (no `User=` line), matching the only access this design has (root over SSH) and the single-owner, single-purpose nature of this box. This is a deliberate trade-off, not an oversight: a dedicated least-privilege system user would be better practice but adds user/permission provisioning this script doesn't otherwise need, for a personal box with no multi-tenant concern today. Revisit if that changes.
- Deploy target is one stable directory, `/opt/squawkmap3d`, updated in place via `rsync --delete` on every deploy (not a symlink-swapped `releases/<n>` pattern). Rejected release-symlink/rollback machinery as unnecessary ceremony for a single personal feeder with no rollback requirement in the request — a redeploy of a previous commit is just re-running the script against that commit, which is enough. `systemctl restart` after every sync (not just `enable --now`, which is a no-op restart-wise if the unit is already running) ensures a redeploy actually picks up new code.

### 5. Deploy verification: poll `/api/health` over the network, from the deploying machine

After restarting the service, the script polls `http://adsb-feeder.local:7500/api/health` (a handful of retries with a short backoff) and checks for `"status":"ok"` before declaring success — exercising the actual network path a user/browser would use, not just an SSH-local `systemctl is-active` check (which would miss port-binding/firewall/network issues). Non-zero exit with a clear message if it never comes up healthy within the timeout.

## Risks / Trade-offs

- **[Risk] Remote Node.js version/absence**: the script assumes Node ≥20.9 (Next 16's floor) is already installed on the feeder box. → *Mitigation*: script checks `node --version` over SSH before building/shipping anything and aborts with a clear message and manual-install pointer, rather than partially deploying then failing at `systemctl start`.
- **[Risk] Root-owned service**: no privilege separation. → *Mitigation*: documented as an accepted trade-off for this single-purpose personal box (Decision 4); not a change to make silently later without calling it out.
- **[Trade-off] No rollback tooling**: a bad deploy must be fixed by redeploying a known-good commit, not by an automated rollback command. Accepted per Non-Goals; the box's downtime window during a bad deploy is a few seconds to the next successful redeploy, not unbounded, since the previous process keeps running until `systemctl restart` actually executes.
- **[Risk] `sharp`/native-binary drift if `next/image` is adopted later**: Decision 2's "safe to cross-build" conclusion holds only while the app has no native runtime dependencies; flagged so a future change adding `next/image` doesn't silently break the deploy.

## Migration Plan

Purely additive: one line in `next.config.js` (`output: "standalone"`), two new files under `scripts/`, a new `README.md` section. No existing app behavior changes, no new npm dependency. Nothing depends on this change existing; rollback is deleting the new files and the `next.config.js` line and, on the box itself, `systemctl disable --now squawkmap3d && rm -rf /opt/squawkmap3d /etc/systemd/system/squawkmap3d.service`.

## Open Questions

- **Flagged for explicit confirmation before implementation**: this design reads "published static version... not hot loaded" as "a real production build (`next build`/standalone `server.js`), not `next dev`" — **not** a literal `next export` static-HTML export (see Decision 1). If the user actually meant a literal static export, the whole serving mechanism changes (no live `/api/health`, likely served by a lightweight static file server instead of a Node process, no systemd Node service). Implementation should not proceed past this point without the user (or Janus, on their behalf) confirming this reading.
- Should the deploy script also offer a `--rollback`/`--to <ref>` mode later? Left as a follow-up per the Non-Goals; not blocking this change.
- Should a reverse proxy (nginx/Caddy) be added in front of port 7500 for TLS or request hardening? Out of scope per Non-Goals — the user asked specifically for the service on port 7500 directly.
