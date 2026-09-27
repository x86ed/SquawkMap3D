## Context

`adsb-win-aircraft-stats` (delivered in `openspec/changes/archive/2026-09-01-adsb-win-aircraft-card-api/`) stores the adsb.win feeder UUID only in `localStorage` (`components/map/overlay/feederUuid.ts`), entered through the inline `FeederUuidForm` in `components/map/overlay/PlaneCard.tsx`. That form's copy, states, and storage functions are considered stable and out of scope here.

Per `feeder-deployment`, this app is deployed directly onto the ADS-B feeder box itself as a **static export** (`output: "export"`, no Node/Next.js server at runtime), served by a plain `nginx:alpine` sidecar Docker container on port 7500, with its own already-customized `scripts/squawkmap3d.nginx.conf` (previously edited once already, to fix `.mjs` MIME type). **There is no server-side code execution available to this app in production** — anything beyond static file serving must either happen in the browser or be handled by nginx configuration itself. This rules out a Next.js API route handler outright; it would never run.

The box's own admin web UI runs on host port 80 (the `dirkhh/adsb-feeder-image` Flask app, reachable at e.g. `http://adsb-feeder.local` or directly on the host network). That admin UI already has the adsb.win UUID: its `/aggregators` route (`GET`) server-renders `aggregators.html`, which contains, per aggregator, an input:

```html
<input type="text" id="{{ conf.identifier }}--ultrafeeder--uuid"
       name="{{ conf.identifier }}--ultrafeeder--uuid"
       value="{{ list_value_by_tags(["ultrafeeder", conf.identifier, "uuid"], m) }}">
```

For adsb.win specifically, `conf.identifier` is the fixed string `adsbwin` (defined in that project's `utils/data.py`), so the field is always `name="adsbwin--ultrafeeder--uuid"` regardless of which box or region it is. This is plain server-rendered HTML, not a JSON API — there is no documented `/api/...` endpoint for this value in that project.

Two things it is *not* safe to assume:
- That the admin UI is reachable from the browser tab the same way the decoder feed already is. The decoder feed's existing CORS-free access (per `feeder-deployment`'s requirement) works because readsb/tar1090's JSON output is designed to be fetched cross-origin; the Flask admin UI has no such guarantee and may reject or simply not answer a browser-originated cross-origin `fetch`.
- That the admin UI has no auth. `dirkhh/adsb-feeder-image` supports an optional password gate (`utils/auth.py`); when enabled, an unauthenticated request to `/aggregators` redirects to a login page instead of the config HTML.

The `squawkmap3d` container already runs on the same Docker host as the admin UI (whether the admin UI itself runs as a host-level process or another container, it's reachable from any container via Docker's `host-gateway` alias — the same mechanism this app's own deploy script can add with `--add-host=host.docker.internal:host-gateway` on `docker run`, a container-runtime flag, not a change to any other container or service).

## Goals / Non-Goals

**Goals:**
- Populate the stored feeder UUID automatically on load whenever it can be read from the box's own admin UI, with zero user input.
- Keep working the same way regardless of which physical feeder box (any unit running the stock `adsb-feeder-image`) is running underneath.
- Leave every existing manual-entry behavior, copy, and state in `PlaneCard.tsx` untouched, so autodiscovery failure is invisible except that the user still has to type the UUID once, exactly as they do today.

**Non-Goals:**
- Reading any aggregator's UUID other than adsb.win's — no other aggregator is consumed by this app today.
- Handling a password-protected admin UI (login flow) — treated as an autodiscovery failure that falls back to manual entry.
- Changing where or how the UUID is stored client-side, or any of the `adsb-win-aircraft-stats` API-calling/caching/error-handling behavior.
- Discovering the feeder box's address over the network (e.g. mDNS resolution logic) — Decision 2 below reaches the admin UI via the Docker host-gateway, not by resolving any hostname the browser used.

## Decisions

**Decision 1 — Same-origin nginx reverse proxy to the admin UI; parse the HTML in client-side JS, not on a server that doesn't exist.**
Add one `location` block to the sidecar's own `scripts/squawkmap3d.nginx.conf` (already edited once for the `.mjs` MIME fix, so this deploy-owned file is an established place to make targeted config additions):

```nginx
location = /feeder-config/aggregators {
    proxy_pass http://host.docker.internal:80/aggregators;
    proxy_set_header Host adsb-feeder.local;
}
```

The browser fetches the same-origin path `/feeder-config/aggregators`; nginx does the actual cross-network request to the admin UI server-to-server, and returns whatever it gets back (HTML body, or a non-2xx) to the browser under this app's own origin. A small client-side TS module (not a Next.js route — there is no server to host one) then parses the returned HTML text for the UUID field, exactly as a server-side parser would have.
- *Why*: this is the only mechanism available at all in a static-export deployment — there's no Next.js server to write a route handler on (see Context). Proxying at the nginx layer, rather than fetching directly from browser JS, keeps the request same-origin so no CORS behavior needs to exist on the admin UI (which this app must never be modified to require, per `feeder-deployment`'s "no interference" requirement) — nginx-to-Flask is a server-to-server request, invisible to the browser's CORS enforcement.
- *Alternative considered*: fetch directly from the browser to `http://adsb-feeder.local/aggregators` (cross-origin, no proxy). Rejected — unconfirmed and unlikely that this authenticated admin UI sets permissive CORS headers; would silently fail to read the response even if the request itself went out.
- *Alternative considered*: read `/opt/adsb/config/.env` (or `config.json`) directly, bind-mounting `ADSB_CONFIG_DIR` read-only into the sidecar container and serving it via a static nginx `alias`. This is a more stable data source (a plain `KEY=VALUE` line, not a template-shaped HTML field) and avoids depending on the Flask admin UI being up or unauthenticated at all. Not chosen for this change only because it requires a new volume-mount step in the deploy script that touches how the container is launched more invasively than a config-file-only edit; worth revisiting if the HTML-scrape route (Decision 3) turns out fragile in practice — noted as an Open Question below.

**Decision 2 — Proxy target is always the Docker host-gateway, not whatever hostname the browser used.**
The `proxy_pass` target is the fixed alias `host.docker.internal`, resolved via `--add-host=host.docker.internal:host-gateway` added to the sidecar's `docker run` invocation in the deploy script (a Docker-runtime flag; Docker Engine ≥ 20.10 on Linux, and already-native on Docker Desktop) — not derived from the incoming request's own `Host` header.
- *Why*: this is what actually makes it generic across feeder boxes. The admin UI always listens on the same host's port 80 by default, regardless of what hostname or IP a particular browser happened to use to reach *this* app (`adsb-feeder.local`, a raw LAN IP, a different mDNS name) — going straight to the host-gateway sidesteps needing to know or guess that address at all, and needs zero fallback logic.
- *Alternative considered*: derive the target from the incoming request's `Host` header (mirroring how the browser reached this app). Rejected — adds complexity for no benefit once nginx already has a direct, unconditional path to the host network; also brittle if the app is ever reached through a different reverse proxy/hostname than the admin UI itself.
- *Alternative considered*: hardcode `adsb-feeder.local` as the proxy target. Rejected — depends on mDNS resolution working *from inside the container's network namespace*, which is a real risk (see Risks); the host-gateway alias is a direct route that doesn't depend on any name resolution at all.

**Decision 3 — Parse the UUID via a targeted regex/DOM match on the known field name, not full HTML parsing.**
Client-side, extract the value from `name="adsbwin--ultrafeeder--uuid"\s+value="([^"]*)"` (attribute-order-tolerant) rather than pulling in an HTML parsing library.
- *Why*: the field name is a fixed, documented identifier (`adsbwin`) from the upstream project, not something that varies per box; a small attribute-scoped extraction is enough and avoids a new dependency for one value, and runs fine as plain browser JS with no server involved.
- *Alternative considered*: full DOM parse (e.g. via `DOMParser`, available in-browser). Rejected as unnecessary weight for extracting one attribute whose surrounding markup is stable upstream; revisit if the upstream template changes shape, or if Decision 1's `.env`-file alternative is adopted instead (trivial `KEY=VALUE` parsing, no HTML at all).

**Decision 4 — Autodiscovery runs once per session, only when no UUID is already stored, and never overwrites a manually-entered value.**
`MapView.tsx` calls the same-origin proxy path on mount only if `getStoredFeederUuid()` returns `null`. A successful parse calls `storeFeederUuid()`; a failure (network error, non-2xx, no match found) is silently ignored and the existing `"not_configured"` UI path (today's `FeederUuidForm`) takes over exactly as it does now.
- *Why*: matches the acceptance criterion "no meaningful changes to the UX" precisely — the only observable difference is that the manual form sometimes doesn't need to be filled in. It also respects a user who has deliberately entered a different UUID (e.g. testing, or a UUID for a different account than the one configured in the admin UI) by never clobbering it.
- *Alternative considered*: re-run autodiscovery whenever the stored UUID hits `"invalid_token"`, to self-heal a stale value. Rejected for this change — it would silently override a value the user may have intentionally typed to replace a stale automatic one, reintroducing exactly the kind of surprising overwrite Decision 4 avoids. Left as an Open Question below.

## Risks / Trade-offs

- **Admin UI has auth enabled** → request gets a login redirect instead of `/aggregators` HTML; parse finds no match, treated as a normal autodiscovery failure, falls back to manual entry (Goal preserved, no crash, no special-case handling needed).
- **Box isn't running `adsb-feeder-image` at all, or an unrelated port-80 service answers** → parse finds no match (or errors) → same graceful fallback.
- **Upstream project renames the `adsbwin` identifier or restructures the template** → autodiscovery silently stops matching → falls back to manual entry; no breakage, just loses the automation until the regex is updated. Mitigation: the parse target is deliberately narrow and documented here so a future update is a one-line regex change; the `.env`-file alternative noted in Decision 1 would remove this risk entirely if it recurs.
- **`host.docker.internal` host-gateway alias unsupported** → on an unusually old Docker Engine or nonstandard container runtime, `--add-host=...:host-gateway` may not resolve. → *Mitigation*: the deploy script's existing prerequisite checks (per `feeder-deployment`'s "fails fast on missing prerequisites" requirement) can verify the alias resolves during deploy; if it doesn't, the proxy `location` simply returns an error, which the client already treats as an ordinary autodiscovery failure (falls back to manual entry, nothing breaks).
- **nginx config edit only takes effect on next deploy/redeploy** → an already-running deployed instance won't get autodiscovery until redeployed with the updated `squawkmap3d.nginx.conf` and `docker run` flags — an accepted one-time redeploy step, same as any other deploy-script change.

## Migration Plan

Additive only — one new `location` block in the existing `scripts/squawkmap3d.nginx.conf`, one new `--add-host` flag in the deploy script's `docker run` invocation, one new client-side parsing/call-site module, no data migration, no schema change. Safe to ship and roll back independently (reverting the nginx config line and the client call site fully restores today's manual-only behavior with no cleanup needed, since nothing new is persisted beyond the existing `localStorage` key `adsbWinFeederUuid` that manual entry already writes to).

## Open Questions

- Should a later change re-attempt autodiscovery when the stored UUID is rejected as `invalid_token` (self-healing after e.g. a UUID rotation), rather than only ever running when nothing is stored? Left for a follow-up change per Decision 4's rationale.
- Should this change switch to reading `/opt/adsb/config/.env` directly (bind-mounted read-only, Decision 1's rejected alternative) instead of scraping `/aggregators` HTML, trading one extra deploy-script volume-mount step for a materially more stable data source? Worth revisiting if the HTML-scrape proves fragile against real upstream changes.
