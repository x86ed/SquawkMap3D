## 1. Flip default state in `components/map/MapView.tsx`

- [ ] 1.1 Change `const militaryVisibleRef = useRef(true);` to `useRef(false)` and `const [militaryVisible, setMilitaryVisible] = useState(true);` to `useState(false)`.
- [ ] 1.2 Change `const suaVisibleRef = useRef(true);` to `useRef(false)` and `const [suaVisible, setSuaVisible] = useState(true);` to `useState(false)`.
- [ ] 1.3 Change `const terrainOutlineVisibleRef = useRef(true);` to `useRef(false)` and `const [terrainOutlineVisible, setTerrainOutlineVisible] = useState(true);` to `useState(false)`.
- [ ] 1.4 Change `const rainViewerVisibleRef = useRef(true);` to `useRef(false)` and `const [rainViewerVisible, setRainViewerVisible] = useState(true);` to `useState(false)`.
- [ ] 1.5 Change `const nexradVisibleRef = useRef(true);` to `useRef(false)` and `const [nexradVisible, setNexradVisible] = useState(true);` to `useState(false)`.
- [ ] 1.6 Change `const noaaRadarVisibleRef = useRef(true);` to `useRef(false)` and `const [noaaRadarVisible, setNoaaRadarVisible] = useState(true);` to `useState(false)`.
- [ ] 1.7 Change `const dwdRadolanVisibleRef = useRef(true);` to `useRef(false)` and `const [dwdRadolanVisible, setDwdRadolanVisible] = useState(true);` to `useState(false)`.
- [ ] 1.8 Change `const noaaInfraredVisibleRef = useRef(true);` to `useRef(false)` and `const [noaaInfraredVisible, setNoaaInfraredVisible] = useState(true);` to `useState(false)`.
- [ ] 1.9 Confirm no other `useState`/`useRef` pair in this file changes — in particular leave `airportsVisible(Ref)`, `openAipVisible(Ref)`, `tfrVisible(Ref)`, `airspaceBoundariesVisible(Ref)`, `rangeOutlineVisible(Ref)`, `aircraftVisible(Ref)`, `userLocationVisible(Ref)`, `rangeRingsVisible(Ref)`, and `terminatorVisible(Ref)` all at `true`.

## 2. Flip the matching fallback defaults in `components/map/layers.ts`

- [ ] 2.1 In `addCustomLayers`, change `const militaryVisible = visibility.military ?? true;` to `?? false`.
- [ ] 2.2 Change `const suaVisibility = (visibility.specialUseAirspace ?? true) ? "visible" : "none";` to `?? false`.
- [ ] 2.3 Change the terrain-outline layer's `visibility: (visibility.terrainOutline ?? true) ? "visible" : "none"` to `?? false`.
- [ ] 2.4 Change the RainViewer layer's `visibility: (visibility.rainViewer ?? true) ? "visible" : "none"` to `?? false`.
- [ ] 2.5 Change the NEXRAD layer's `visibility: (visibility.nexrad ?? true) ? "visible" : "none"` to `?? false`.
- [ ] 2.6 Change the NOAA Radar layer's `visibility: (visibility.noaaRadar ?? true) ? "visible" : "none"` to `?? false`.
- [ ] 2.7 Change the DWD RADOLAN layer's `visibility: (visibility.dwdRadolan ?? true) ? "visible" : "none"` to `?? false`.
- [ ] 2.8 Change the NOAA Infrared layer's `visibility: (visibility.noaaInfrared ?? true) ? "visible" : "none"` to `?? false`.
- [ ] 2.9 Leave every other fallback (`airportsVisible`, `visibility.openAip ?? true`, `tfrVisibility`, `visibility.airspaceBoundaries ?? true`, `rangeOutlineVisibility`) at `?? true`.
- [ ] 2.10 Update the `CustomLayerVisibility` interface's doc comment (currently reads as if every field defaults the same way) to state that `military`, `specialUseAirspace`, `terrainOutline`, `rainViewer`, `nexrad`, `noaaInfrared`, `noaaRadar`, and `dwdRadolan` default to `false` (hidden) when omitted, while every other field defaults to `true` (visible) — matching design.md's Decision 1/2.

## 3. Add a regression test pinning the new defaults

- [ ] 3.1 Create `test/layers.test.ts` following `test/userLocation.test.ts`'s fake-`MapLibreMap` pattern (a minimal object with `getLayer`, `addLayer`, `getSource`, `addSource`, `setLayoutProperty`, `getStyle`, tracking each added layer's `layout.visibility` in a `Map`).
- [ ] 3.2 Add a test that calls `addCustomLayers(fakeMap as never, "light", {})` and asserts, per design.md Decision 3, that `MILITARY_FILL_LAYER_ID`, `MILITARY_LINE_LAYER_ID`, `SUA_FILL_LAYER_ID`, `SUA_LINE_LAYER_ID`, `TERRAIN_OUTLINE_LINE_LAYER_ID`, `RAINVIEWER_LAYER_ID`, `NEXRAD_LAYER_ID`, `NOAA_RADAR_LAYER_ID`, `DWD_RADOLAN_LAYER_ID`, and `NOAA_INFRARED_LAYER_ID` are all `"none"`, while `AIRPORTS_LAYER_ID`, `TFR_FILL_LAYER_ID`, `TFR_LINE_LAYER_ID`, `AIRSPACE_BOUNDARIES_LINE_LAYER_ID`, `RANGE_OUTLINE_FILL_LAYER_ID`, and `RANGE_OUTLINE_LINE_LAYER_ID` are all `"visible"`. (`OPENAIP_LAYER_ID` is conditional on `getOpenAipApiKey()`; either stub that to return a key so the layer is added and assert it too, or note in the test why it's skipped.)
- [ ] 3.3 Add a second test that calls `addCustomLayers(fakeMap as never, "light", { military: true, rainViewer: true })` (a couple of the flipped keys explicitly overridden back on) and asserts those specific layers come back `"visible"` while the other, non-overridden flipped keys stay `"none"` — pins that the fallback only applies when a key is actually omitted.

## 4. Verify end-to-end

- [ ] 4.1 Run `npm test` and confirm the new `test/layers.test.ts` passes alongside the existing suite.
- [ ] 4.2 Run `npm run lint`.
- [ ] 4.3 Run `npm run dev`, load the app fresh (no prior session state to clear — this state isn't persisted), open the layer-control drawer, and manually confirm: Military Bases, Special Use Airspace, Terrain-Based Range Outline, RainViewer, NEXRAD, NOAA Radar, DWD RADOLAN, and NOAA Infrared all show unchecked; Airports, OpenAIP TMS, TFRs, Airspace Boundaries, Aircraft, Transponder Location, Actual Range Outline, Range Rings, and Day/Night Terminator all show checked. Confirm the accordion on-count badges (`Aviation`, `Location`, `Environmental`, nested `Weather`) reflect the new counts correctly.
