# SquawkMap3D
Squawk Map 3D

## Setup

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_MAPTILER_KEY` to a MapTiler API key (used for the light/dark base map style and terrain-DEM source). Get one free at https://cloud.maptiler.com/account/keys/.

Optionally set `NEXT_PUBLIC_FEEDER_URL` to your ADS-B feeder's `aircraft.json` endpoint (readsb/dump1090-fa/tar1090-compatible) to enable the aircraft tracks layer. Left unset, that layer stays off.

## Attribution

Aircraft icons under `public/aircraft-shapes/` are vendored from [AircraftShapesSVG](https://github.com/RexKramer1/AircraftShapesSVG) (GPL-3.0), keyed by ICAO type designator.

Fallback silhouettes under `public/aircraft-silhouettes/` are vendored from [pw-silhouettes](https://github.com/plane-watch/pw-silhouettes) (CC BY-NC-SA 4.0 — non-commercial), one per ADS-B emitter category, used when no type-specific icon exists.

Both are vendored (not live-fetched) via `scripts/vendor-aircraft-icons.mjs`; re-run it and commit the result to refresh either set. See each directory's own `LICENSE` file.
