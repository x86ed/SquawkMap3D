## Why

The user-location marker is currently a rotating 3D `fill-extrusion` radar mast, stylized at an exaggerated scale just to stay visible on screen. It's visually heavy next to the flat 2D sectional/radar layers, doesn't match the range rings' color, and there's no way to hide it (or the rings) once it's served its purpose of confirming "this is where I am."

## What Changes

- Replace the 3D radar-mast marker (`fill-extrusion` pedestal + rotating blade) with a static `sat.svg` icon rendered as a MapLibre symbol layer, anchored at the user's location.
- Recolor the satellite icon to the same blue used for the range rings (`#00b8db`), following the existing single-color SVG-rasterization pattern (`airportIcon.ts`).
- Remove the dish-rotation animation loop (`startDishRotation`) and its mast/blade geometry builders — no longer needed once the marker is a static icon.
- Add a single "toggle user location" control that shows/hides both the satellite icon and the 4 range rings (+ labels) together, alongside the map's other layer-visibility buttons.
- **BREAKING**: `startDishRotation`, `buildDishPedestal`, `buildDishBlade`, and the `USER_DISH_LAYER_ID` fill-extrusion layer are removed from `userLocation.ts`'s public surface.

## Capabilities

### New Capabilities
(none — this modifies the existing user-location-marker capability)

### Modified Capabilities
- `user-location-marker`: the "3D rotating radar marker at user location" requirement is replaced by a static, ring-colored satellite-icon marker requirement; a new requirement adds a combined show/hide toggle for the marker + range rings.

## Impact

- `components/map/userLocation.ts`: drop dish/blade geometry + rotation; add a point feature + symbol layer for the icon; add a visibility setter for marker + rings together.
- `components/map/userLocationIcon.ts` (new): rasterizes and registers the recolored `sat.svg` as a map image, mirroring `airportIcon.ts`.
- `public/sat.svg` (new): satellite glyph asset.
- `components/map/MapView.tsx`: drop `restartDishRotation`/rotation-stop plumbing; add a `userLocationVisible` toggle button wired to the new visibility setter.
- `openspec/specs/user-location-marker/spec.md`: requirement delta for the marker's appearance and the new toggle.
