## Context

`adsb-win-aircraft-stats` (delivered in `openspec/changes/archive/2026-09-01-adsb-win-aircraft-card-api/`) stores the adsb.win feeder UUID only in `localStorage` (`components/map/overlay/feederUuid.ts`), entered through the inline `FeederUuidForm` in `components/map/overlay/PlaneCard.tsx`. That form's copy, states, and storage functions are considered stable and out of scope here.

Per `feeder-deployment`, this app is deployed directly onto the ADS-B feeder box itself, listening on port 7500, alongside the box's own admin web UI on port 80 (the `dirkhh/adsb-feeder-image` Flask app, reachable at e.g. `http://adsb-feeder.local`). That admin UI already has the adsb.win UUID: its `/aggregators` route (`GET`) server-renders `aggregators.html`, which contains, per aggregator, an input:

```html
<input type="text" id="{{ conf.identifier }}--ultrafeeder--uuid"
       name="{{ conf.identifier }}--ultrafeeder--uuid"
       value="{{ list_value_by_tags(["ultrafeeder", conf.identifier, "uuid"], m) }}">
```

For adsb.win specifically, `conf.identifier` is the fixed string `adsbwin` (defined in that project's `utils/data.py`), so the field is always `name="adsbwin--ultrafeeder--uuid"` regardless of which box or region it is. This is plain server-rendered HTML, not a JSON API — there is no documented `/api/...` endpoint for this value in that project.

Two things it is *not* safe to assume:
- That the admin UI is reachable from the browser tab the same way the decoder feed already is. The decoder feed's existing CORS-free access (per `feeder-deployment`'s requirement) works because readsb/tar1090's JSON output is designed to be fetched cross-origin; the Flask admin UI has no such guarantee and may reject or simply not answer a browser-originated cross-origin `fetch`.
- That the admin UI has no auth. `dirkhh/adsb-feeder-image` supports an optional password gate (`utils/auth.py`); when enabled, an unauthenticated request to `/aggregators` redirects to a login page instead of the config HTML.

## Goals / Non-Goals

**Goals:**
- Populate the stored feeder UUID automatically on load whenever it can be read from the box's own admin UI, with zero user input.
- Keep working the same way regardless of which physical feeder box (any unit running the stock `adsb-feeder-image`) is running underneath.
- Leave every existing manual-entry behavior, copy, and state in `PlaneCard.tsx` untouched, so autodiscovery failure is invisible except that the user still has to type the UUID once, exactly as they do today.

**Non-Goals:**
- Reading any aggregator's UUID other than adsb.win's — no other aggregator is consumed by this app today.
- Handling a password-protected admin UI (login flow) — treated as an autodiscovery failure that falls back to manual entry.
- Changing where or how the UUID is stored client-side, or any of the `adsb-win-aircraft-stats` API-calling/caching/error-handling behavior.
- Discovering the feeder box's address over the network (e.g. mDNS resolution logic) beyond the fixed hostname/port scheme in Decision 2.

## Decisions

**Decision 1 — Fetch and parse server-side, not from the browser.**
Add a Next.js route handler (`app/api/feeder-uuid/route.ts`) that runs on the server (i.e., on the feeder box itself, since that's where this app is deployed) and does the `GET /aggregators` request itself, over plain `localhost`/loopback-adjacent HTTP, then returns `{ uuid: string | null }` as JSON to the client. The client (`MapView.tsx`) calls this same-origin route instead of touching the admin UI directly.
- *Why*: eliminates the CORS risk entirely (the browser only ever talks to its own origin); a server-to-server request on the same box is also faster and doesn't depend on the box's own CORS configuration, which this app must never modify (per `feeder-deployment`'s "no interference" requirement).
- *Alternative considered*: fetch directly from the browser to `http://adsb-feeder.local/aggregators`. Rejected — depends on that admin UI allowing cross-origin reads, which it has no reason to support and which this app must not request a change to (would violate "don't modify existing feeder software" from `feeder-deployment`).

**Decision 2 — Address the admin UI via the request's own hostname, port 80; try `adsb-feeder.local` as a documented fallback.**
The route handler first tries `http://{host}` where `{host}` is the hostname the incoming request itself arrived on (stripped of any port) — i.e., whatever address the user is already using to reach this app, since the admin UI lives on the same box on port 80 by default. If that fails (network error or non-2xx), it retries `http://adsb-feeder.local`.
- *Why*: makes this generic across boxes without any configuration — it works whether the user reaches the app via `adsb-feeder.local`, a raw LAN IP, or a different mDNS name, because it reuses whatever host got the request there. The `adsb-feeder.local` fallback covers the one asymmetric case: app reached via IP but admin UI's mDNS name still resolves.
- *Alternative considered*: hardcode `adsb-feeder.local` only. Rejected — fails acceptance criterion "work generically with other feeders" whenever a box is reached by IP or a custom hostname (multi-feeder households, non-mDNS networks).
- *Alternative considered*: an environment variable for the admin UI's base URL. Rejected as unnecessary — no user-facing config step should exist per the acceptance criteria, and the host-reuse heuristic covers the deployed topology already documented in `feeder-deployment`.

**Decision 3 — Parse the UUID via a targeted regex/DOM match on the known field name, not full HTML parsing.**
Extract the value from `name="adsbwin--ultrafeeder--uuid"\s+value="([^"]*)"` (attribute-order-tolerant) rather than pulling in an HTML parsing library.
- *Why*: the field name is a fixed, documented identifier (`adsbwin`) from the upstream project, not something that varies per box; a small attribute-scoped extraction is enough and avoids a new dependency for one value.
- *Alternative considered*: full DOM parse (e.g. `linkedom`/`cheerio`). Rejected as unnecessary weight for extracting one attribute whose surrounding markup is stable upstream; revisit if the upstream template changes shape.

**Decision 4 — Autodiscovery runs once per session, only when no UUID is already stored, and never overwrites a manually-entered value.**
`MapView.tsx` calls the new endpoint on mount only if `getStoredFeederUuid()` returns `null`. A successful response calls `storeFeederUuid()`; a failure (network error, non-2xx, no match found) is silently ignored and the existing `"not_configured"` UI path (today's `FeederUuidForm`) takes over exactly as it does now.
- *Why*: matches the acceptance criterion "no meaningful changes to the UX" precisely — the only observable difference is that the manual form sometimes doesn't need to be filled in. It also respects a user who has deliberately entered a different UUID (e.g. testing, or a UUID for a different account than the one configured in the admin UI) by never clobbering it.
- *Alternative considered*: re-run autodiscovery whenever the stored UUID hits `"invalid_token"`, to self-heal a stale value. Rejected for this change — it would silently override a value the user may have intentionally typed to replace a stale automatic one, reintroducing exactly the kind of surprising overwrite Decision 4 avoids. Left as an Open Question below.

## Risks / Trade-offs

- **Admin UI has auth enabled** → request gets a login redirect instead of `/aggregators` HTML; parse finds no match, treated as a normal autodiscovery failure, falls back to manual entry (Goal preserved, no crash, no special-case handling needed).
- **Box isn't running `adsb-feeder-image` at all, or an unrelated port-80 service answers** → parse finds no match (or errors) → same graceful fallback.
- **Upstream project renames the `adsbwin` identifier or restructures the template** → autodiscovery silently stops matching → falls back to manual entry; no breakage, just loses the automation until the regex is updated. Mitigation: the parse target is deliberately narrow and documented here so a future update is a one-line regex change.
- **Server-side fetch to a `.local` mDNS name from within the Next.js server runtime** → some Node runtimes need multicast-DNS resolution support that isn't always available depending on the deployment container's networking config; if `adsb-feeder.local` fails to resolve, the primary path (Decision 2, using the incoming request's own host) still normally succeeds since that's how the browser reached the app in the first place.

## Migration Plan

Additive only — new route, new call site, no data migration, no schema change. Safe to ship and roll back independently (removing the new route/call site fully restores today's manual-only behavior with no cleanup needed, since nothing new is persisted beyond the existing `localStorage` key `adsbWinFeederUuid` that manual entry already writes to).

## Open Questions

- Should a later change re-attempt autodiscovery when the stored UUID is rejected as `invalid_token` (self-healing after e.g. a UUID rotation), rather than only ever running when nothing is stored? Left for a follow-up change per Decision 4's rationale.
