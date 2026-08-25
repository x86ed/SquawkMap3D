/**
 * Flight route (origin/destination) lookup for `FlightInfoPane`.
 *
 * **Discovery finding (see openspec/changes/aircraft-info-overlay/tasks.md
 * section 3's blocking discovery task):** this design originally assumed
 * tar1090 serves its own route database as a static file bundled with its
 * install (something this app's nginx sidecar could proxy same-origin,
 * mirroring `feederLocation.ts`'s `receiver.json`/`outline.json` pattern).
 * That assumption was checked directly against tar1090's own current source
 * (`wiedehopf/tar1090`, `html/planeObject.js`'s `routeDoLookup()` /
 * `html/defaults.js`'s `routeApiUrl`) rather than guessed, and is **false**:
 * tar1090 has no local/feeder-side route file at all. Its own web UI
 * resolves routes by POSTing `{ planes: [{ callsign, lat, lng }, ...] }`
 * directly from the browser to a public third-party API —
 * `https://adsb.im/api/0/routeset` by default (alternative:
 * `https://api.adsb.lol/api/0/routeset`) — which this app's design
 * explicitly scoped as a Non-Goal to avoid introducing
 * (openspec/changes/aircraft-info-overlay/design.md Decision 12: "no new
 * third-party service ... is needed or used").
 *
 * There is therefore no confirmed same-origin endpoint for
 * `scripts/squawkmap3d.nginx.conf` to proxy. Rather than fabricate one or
 * unilaterally wire up the third-party API the design explicitly avoided,
 * this stays a documented no-op: always resolves `null` (never rejects,
 * mirroring `feederLocation.ts`'s `getFeederLocation()` contract exactly),
 * so `FlightInfoPane` renders its legitimate "no route data available"
 * empty state for every aircraft until this is revisited with an explicit
 * decision on whether to call the third-party API directly (like
 * `rainviewer.ts`/`openAip` already do for other third-party feeds) or
 * accept the permanent empty state.
 */
export interface FlightRoute {
  origin?: string;
  destination?: string;
}

export async function getFlightRoute(callsign: string): Promise<FlightRoute | null> {
  void callsign; // kept in the signature per design.md Decision 12's contract — unused until the open item above is resolved
  return null;
}
