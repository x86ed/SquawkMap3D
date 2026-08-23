## Why

SquawkMap3D's original design called for a broader set of aeronautical and weather overlays than what's currently implemented. Today the map only has airports, military bases, an FAA VFR sectional (pilot mode), and a day/night terminator. Pilots and weather-aware users lack airspace context (controlled airspace, TFRs, special use airspace) and precipitation/satellite overlays that a flight-planning map is expected to have. Adding these closes the gap to parity with the original design.

## What Changes

- Add **OpenAIP TMS** layer: raster tile overlay of aeronautical airspace (controlled airspace boundaries, TMAs) from OpenAIP's tile service.
- Add **RainViewer Radar** layer: animated global precipitation radar overlay via RainViewer's public tile API.
- Add **US TFR** layer: Temporary Flight Restriction polygons sourced from FAA/aviationweather.gov.
- Add **US Special Use Airspace** layer: restricted, prohibited, warning, alert, and MOA areas.
- Add **US NEXRAD** layer: national base reflectivity radar mosaic raster overlay.
- Add **US NOAA InfraredSat** layer: NOAA GOES infrared satellite imagery raster overlay.
- Add **US NOAA Radar** layer: NOAA-hosted radar tile overlay, distinct source/styling from the NEXRAD mosaic.
- Add **Europe DWD RADOLAN** layer: German Weather Service (DWD) RADOLAN precipitation radar mosaic, scoped to Europe.
- Each new layer follows the existing toggle pattern (source/layer add in `components/map/layers.ts`, a `set<Layer>Visibility` function, a toggle button in `MapView.tsx`, persists across theme switches and pilot mode per existing convention).

## Capabilities

### New Capabilities
- `openaip-airspace-layer`: OpenAIP TMS raster overlay of controlled airspace, toggleable, rendered on the map.
- `rainviewer-radar-layer`: RainViewer animated global precipitation radar overlay, toggleable.
- `tfr-layer`: US FAA Temporary Flight Restriction polygons, toggleable.
- `special-use-airspace-layer`: US Special Use Airspace areas (restricted/prohibited/warning/alert/MOA), toggleable.
- `nexrad-layer`: US NEXRAD base reflectivity radar mosaic overlay, toggleable.
- `noaa-infrared-satellite-layer`: NOAA GOES infrared satellite imagery overlay, toggleable.
- `noaa-radar-layer`: NOAA-hosted radar tile overlay, toggleable.
- `dwd-radolan-layer`: DWD RADOLAN precipitation radar mosaic overlay (Europe), toggleable.

### Modified Capabilities
(none — existing layer capabilities are unchanged; new layers are additive)

## Impact

- `components/map/layers.ts`: new source/layer registration and visibility setters per new layer.
- `components/map/constants.ts`: new tile URL / attribution / zoom-bound constants per new layer.
- `components/map/MapView.tsx`: new state/ref pairs and toggle buttons per new layer.
- No breaking changes to existing layers or map behavior.
- New external tile/data dependencies: OpenAIP, RainViewer, FAA/aviationweather.gov (TFR, SUA), NEXRAD radar mosaic source, NOAA GOES infrared, NOAA radar, DWD RADOLAN — each may require attribution text and, for OpenAIP, an API key.
