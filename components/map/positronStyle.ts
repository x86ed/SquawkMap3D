import type { StyleSpecification } from "maplibre-gl";

/**
 * "Positron" (CARTO/openmaptiles/positron-gl-style), adapted as the app's
 * light theme. Positron and Dark Matter are sibling OpenMapTiles styles with
 * near-identical layer structure (same ids/filters/source-layers) and only
 * differ in palette, so this mirrors `BASE_LAYERS` in `darkMatterStyle.ts`
 * layer-for-layer, swapping in Positron's light, muted colors. Three layers
 * absent from the dark stack are added because they're part of Positron's
 * signature look: `waterway` (river/stream lines), and
 * `tunnel_motorway_casing`/`tunnel_motorway_inner` (light-gray tunnel
 * roads).
 *
 * `aeroway-*` (bright purple/magenta runway & taxiway markings) and
 * `building`/`road_area_pier`/`water_name` are outside the palette this
 * theme's design reference (CARTO Positron) specifies. The aeroway colors
 * are kept byte-for-byte identical to the dark theme's — they read as a
 * deliberate high-visibility accent for aviation infrastructure rather than
 * a basemap palette choice, so recoloring them wasn't part of this restyle.
 * `building`/`road_area_pier`/`water_name` got neutral, understated
 * light-gray/blue-gray fills consistent with the rest of the Positron
 * palette below since they still need *some* color to render sensibly on a
 * light background.
 *
 * Unlike the dark theme (see `getDarkMatterStyle`), no contour layers are
 * spliced in here — 3D terrain elevation (`applyTerrain`/`setTerrain` in
 * `terrain.ts`) is applied independently of the active style's layers, so
 * pitched 3D terrain still works with this theme regardless of contours.
 *
 * A `Hillshade` layer *is* spliced in (see `getPositronStyle`), right after
 * `background` like the dark theme's, but with stronger shadow contrast and
 * exaggeration than `HILLSHADE_LAYER` in `darkMatterStyle.ts` — relief
 * shading reads much fainter against this style's light, low-contrast
 * palette than it does against Dark Matter's near-black one, so it needs a
 * heavier hand here to stay legible.
 */
const BASE_LAYERS: StyleSpecification["layers"] = [
  {
    id: "background",
    type: "background",
    paint: {
      "background-color": "rgb(242,243,240)",
    },
  },
  {
    id: "water",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "water",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "brunnel", "tunnel"]],
    layout: {
      visibility: "visible",
    },
    paint: {
      "fill-antialias": true,
      "fill-color": "rgb(194, 200, 202)",
    },
  },
  {
    id: "landcover_ice_shelf",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    maxzoom: 8,
    filter: ["all", ["==", "$type", "Polygon"], ["==", "subclass", "ice_shelf"]],
    layout: {
      visibility: "visible",
    },
    paint: {
      "fill-color": "hsl(0, 0%, 98%)",
      "fill-opacity": 0.7,
    },
  },
  {
    id: "landcover_glacier",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    maxzoom: 8,
    filter: ["all", ["==", "$type", "Polygon"], ["==", "subclass", "glacier"]],
    layout: {
      visibility: "visible",
    },
    paint: {
      "fill-color": "hsl(0, 0%, 98%)",
      "fill-opacity": {
        base: 1,
        stops: [
          [0, 1],
          [8, 0.5],
        ],
      } as unknown as number,
    },
  },
  {
    id: "landuse_residential",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landuse",
    maxzoom: 9,
    filter: ["all", ["==", "$type", "Polygon"], ["==", "class", "residential"]],
    layout: {
      visibility: "visible",
    },
    paint: {
      "fill-color": "rgb(234, 234, 230)",
      "fill-opacity": {
        base: 0.6,
        stops: [
          [8, 0.8],
          [9, 0.6],
        ],
      } as unknown as number,
    },
  },
  {
    id: "landcover_wood",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    minzoom: 10,
    filter: ["all", ["==", "$type", "Polygon"], ["==", "class", "wood"]],
    layout: {
      visibility: "visible",
    },
    paint: {
      "fill-color": "rgb(220,224,220)",
      "fill-opacity": {
        base: 1,
        stops: [
          [8, 0],
          [12, 1],
        ],
      } as unknown as number,
      "fill-pattern": "wood-pattern",
      "fill-translate": [0, 0],
    },
  },
  {
    id: "waterway",
    type: "line",
    source: "openmaptiles",
    "source-layer": "waterway",
    filter: ["==", "$type", "LineString"],
    layout: {
      visibility: "visible",
    },
    paint: {
      "line-color": "hsl(195, 17%, 78%)",
    },
  },
  {
    id: "landuse_park",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landuse",
    filter: ["all", ["==", "$type", "Polygon"], ["==", "class", "park"]],
    layout: {
      visibility: "visible",
    },
    paint: {
      "fill-color": "rgb(230, 233, 229)",
    },
  },
  {
    id: "water_name",
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "water_name",
    filter: ["==", "$type", "LineString"],
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": 500,
      "text-field": "{name:latin}\n{name:nonlatin}",
      "text-font": ["Metropolis Medium Italic", "Noto Sans Italic"],
      "text-rotation-alignment": "map",
      "text-size": 12,
    },
    paint: {
      "text-color": "rgb(157, 169, 177)",
      "text-halo-color": "rgb(242,243,240)",
    },
  },
  {
    id: "building",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "building",
    minzoom: 12,
    filter: ["==", "$type", "Polygon"],
    paint: {
      "fill-antialias": true,
      "fill-color": "rgb(224, 224, 220)",
      "fill-outline-color": "rgb(212, 212, 207)",
    },
  },
  {
    id: "aeroway-taxiway",
    type: "line",
    metadata: { "mapbox:group": "1444849345966.4436" },
    source: "openmaptiles",
    "source-layer": "aeroway",
    minzoom: 12,
    filter: ["all", ["in", "class", "taxiway"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "visible",
    },
    paint: {
      "line-color": "rgba(102, 0, 255, 1)",
      "line-opacity": 1,
      "line-width": {
        base: 1.55,
        stops: [
          [13, 1.8],
          [20, 20],
        ],
      } as unknown as number,
    },
  },
  {
    id: "aeroway-runway-casing",
    type: "line",
    metadata: { "mapbox:group": "1444849345966.4436" },
    source: "openmaptiles",
    "source-layer": "aeroway",
    minzoom: 11,
    filter: ["all", ["in", "class", "runway"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "visible",
    },
    paint: {
      "line-color": "rgba(82, 0, 255, 0.8)",
      "line-opacity": 1,
      "line-width": {
        base: 1.5,
        stops: [
          [11, 5],
          [17, 55],
        ],
      } as unknown as number,
    },
  },
  {
    id: "aeroway-area",
    type: "fill",
    metadata: { "mapbox:group": "1444849345966.4436" },
    source: "openmaptiles",
    "source-layer": "aeroway",
    minzoom: 4,
    filter: [
      "all",
      ["==", "$type", "Polygon"],
      ["in", "class", "runway", "taxiway"],
    ],
    layout: {
      visibility: "visible",
    },
    paint: {
      "fill-color": "rgba(82, 0, 255, 1)",
      "fill-opacity": 1,
    },
  },
  {
    id: "aeroway-runway",
    type: "line",
    metadata: { "mapbox:group": "1444849345966.4436" },
    source: "openmaptiles",
    "source-layer": "aeroway",
    minzoom: 11,
    filter: ["all", ["in", "class", "runway"], ["==", "$type", "LineString"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "visible",
    },
    paint: {
      "line-color": "rgba(206, 0, 255, 0.65)",
      "line-opacity": 1,
      "line-width": {
        base: 1.5,
        stops: [
          [11, 4],
          [17, 50],
        ],
      } as unknown as number,
    },
  },
  {
    id: "tunnel_motorway_casing",
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom: 6,
    filter: [
      "all",
      ["==", "$type", "LineString"],
      ["all", ["==", "brunnel", "tunnel"], ["==", "class", "motorway"]],
    ],
    layout: {
      "line-cap": "butt",
      "line-join": "miter",
      visibility: "visible",
    },
    paint: {
      "line-color": "rgb(213, 213, 213)",
      "line-opacity": 1,
      "line-width": {
        base: 1.4,
        stops: [
          [5.8, 0],
          [6, 3],
          [20, 40],
        ],
      } as unknown as number,
    },
  },
  {
    id: "tunnel_motorway_inner",
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom: 6,
    filter: [
      "all",
      ["==", "$type", "LineString"],
      ["all", ["==", "brunnel", "tunnel"], ["==", "class", "motorway"]],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "visible",
    },
    paint: {
      "line-color": "rgb(234,234,234)",
      "line-width": {
        base: 1.4,
        stops: [
          [4, 2],
          [6, 1.3],
          [20, 30],
        ],
      } as unknown as number,
    },
  },
  {
    id: "road_area_pier",
    type: "fill",
    metadata: {},
    source: "openmaptiles",
    "source-layer": "transportation",
    filter: ["all", ["==", "$type", "Polygon"], ["==", "class", "pier"]],
    layout: {
      visibility: "visible",
    },
    paint: {
      "fill-antialias": true,
      "fill-color": "rgb(242,243,240)",
    },
  },
  {
    id: "road_pier",
    type: "line",
    metadata: {},
    source: "openmaptiles",
    "source-layer": "transportation",
    filter: ["all", ["==", "$type", "LineString"], ["in", "class", "pier"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "rgb(242,243,240)",
      "line-width": {
        base: 1.2,
        stops: [
          [15, 1],
          [17, 4],
        ],
      } as unknown as number,
    },
  },
  {
    id: "boundary_state",
    type: "line",
    metadata: { "mapbox:group": "a14c9607bc7954ba1df7205bf660433f" },
    source: "openmaptiles",
    "source-layer": "boundary",
    filter: ["==", "admin_level", 4],
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "visible",
    },
    paint: {
      "line-blur": 0.4,
      "line-color": "rgb(230, 204, 207)",
      "line-dasharray": [2, 2],
      "line-opacity": 1,
      "line-width": {
        base: 1.3,
        stops: [
          [3, 1],
          [22, 15],
        ],
      } as unknown as number,
    },
  },
  {
    id: "boundary_country_z0-4",
    type: "line",
    metadata: { "mapbox:group": "a14c9607bc7954ba1df7205bf660433f" },
    source: "openmaptiles",
    "source-layer": "boundary",
    maxzoom: 5,
    filter: ["all", ["==", "admin_level", 2], ["!has", "claimed_by"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-blur": {
        base: 1,
        stops: [
          [0, 0.4],
          [22, 4],
        ],
      } as unknown as number,
      "line-color": "rgb(230, 204, 207)",
      "line-opacity": 1,
      "line-width": {
        base: 1.1,
        stops: [
          [3, 1],
          [22, 20],
        ],
      } as unknown as number,
    },
  },
  {
    id: "boundary_country_z5-",
    type: "line",
    metadata: { "mapbox:group": "a14c9607bc7954ba1df7205bf660433f" },
    source: "openmaptiles",
    "source-layer": "boundary",
    minzoom: 5,
    filter: ["==", "admin_level", 2],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-blur": {
        base: 1,
        stops: [
          [0, 0.4],
          [22, 4],
        ],
      } as unknown as number,
      "line-color": "rgb(230, 204, 207)",
      "line-opacity": 1,
      "line-width": {
        base: 1.1,
        stops: [
          [3, 1],
          [22, 20],
        ],
      } as unknown as number,
    },
  },
  {
    id: "place_other",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 14,
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["in", "class", "hamlet", "isolated_dwelling", "neighbourhood"],
    ],
    layout: {
      "text-anchor": "center",
      "text-field": "{name:latin}\n{name:nonlatin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-justify": "center",
      "text-offset": [0.5, 0],
      "text-size": 10,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "text-color": "rgb(117, 129, 145)",
      "text-halo-blur": 1,
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1,
    },
  },
  {
    id: "place_suburb",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 15,
    filter: ["all", ["==", "$type", "Point"], ["==", "class", "suburb"]],
    layout: {
      "text-anchor": "center",
      "text-field": "{name:latin}\n{name:nonlatin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-justify": "center",
      "text-offset": [0.5, 0],
      "text-size": 10,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "text-color": "rgb(117, 129, 145)",
      "text-halo-blur": 1,
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1,
    },
  },
  {
    id: "place_village",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 14,
    filter: ["all", ["==", "$type", "Point"], ["==", "class", "village"]],
    layout: {
      "icon-size": 0.4,
      "text-anchor": "left",
      "text-field": "{name:latin}\n{name:nonlatin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-justify": "left",
      "text-offset": [0.5, 0.2],
      "text-size": 10,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "icon-opacity": 0.7,
      "text-color": "rgb(117, 129, 145)",
      "text-halo-blur": 1,
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1,
    },
  },
  {
    id: "place_town",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 15,
    filter: ["all", ["==", "$type", "Point"], ["==", "class", "town"]],
    layout: {
      "icon-image": {
        base: 1,
        stops: [
          [0, "circle-11"],
          [9, ""],
        ],
      } as unknown as string,
      "icon-size": 0.4,
      "text-anchor": {
        base: 1,
        stops: [
          [0, "left"],
          [8, "center"],
        ],
      } as unknown as string,
      "text-field": "{name:latin}\n{name:nonlatin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-justify": "left",
      "text-offset": [0.5, 0.2],
      "text-size": 10,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "icon-opacity": 0.7,
      "text-color": "rgb(117, 129, 145)",
      "text-halo-blur": 1,
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1,
    },
  },
  {
    id: "place_city",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 14,
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "class", "city"],
      [">", "rank", 3],
    ],
    layout: {
      "icon-image": {
        base: 1,
        stops: [
          [0, "circle-11"],
          [9, ""],
        ],
      } as unknown as string,
      "icon-size": 0.4,
      "text-anchor": {
        base: 1,
        stops: [
          [0, "left"],
          [8, "center"],
        ],
      } as unknown as string,
      "text-field": "{name:latin}\n{name:nonlatin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-justify": "left",
      "text-offset": [0.5, 0.2],
      "text-size": 10,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "icon-opacity": 0.7,
      "text-color": "rgb(117, 129, 145)",
      "text-halo-blur": 1,
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1,
    },
  },
  {
    id: "place_city_large",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 12,
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["<=", "rank", 3],
      ["==", "class", "city"],
    ],
    layout: {
      "icon-image": {
        base: 1,
        stops: [
          [0, "circle-11"],
          [9, ""],
        ],
      } as unknown as string,
      "icon-size": 0.4,
      "text-anchor": {
        base: 1,
        stops: [
          [0, "left"],
          [8, "center"],
        ],
      } as unknown as string,
      "text-field": "{name:latin}\n{name:nonlatin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-justify": "left",
      "text-offset": [0.5, 0.2],
      "text-size": 14,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "icon-opacity": 0.7,
      "text-color": "rgb(117, 129, 145)",
      "text-halo-blur": 1,
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1,
    },
  },
  {
    id: "place_state",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 12,
    filter: ["all", ["==", "$type", "Point"], ["==", "class", "state"]],
    layout: {
      "text-field": "{name:latin}\n{name:nonlatin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-size": 10,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "text-color": "rgb(117, 129, 145)",
      "text-halo-blur": 1,
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1,
    },
  },
  {
    id: "place_country_other",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 8,
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "class", "country"],
      ["!has", "iso_a2"],
    ],
    layout: {
      "text-field": "{name:latin}",
      "text-font": ["Metropolis Light Italic", "Noto Sans Italic"],
      "text-size": {
        base: 1,
        stops: [
          [0, 9],
          [1, 11],
        ],
      } as unknown as number,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "text-color": "rgb(117, 129, 145)",
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1.4,
    },
  },
  {
    id: "place_country_minor",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 8,
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "class", "country"],
      [">=", "rank", 2],
      ["has", "iso_a2"],
    ],
    layout: {
      "text-field": "{name:latin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-size": {
        base: 1,
        stops: [
          [0, 10],
          [6, 12],
        ],
      } as unknown as number,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "text-color": "rgb(117, 129, 145)",
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1.4,
    },
  },
  {
    id: "place_country_major",
    type: "symbol",
    metadata: { "mapbox:group": "101da9f13b64a08fa4b6ac1168e89e5f" },
    source: "openmaptiles",
    "source-layer": "place",
    maxzoom: 6,
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["<=", "rank", 1],
      ["==", "class", "country"],
      ["has", "iso_a2"],
    ],
    layout: {
      "text-anchor": "center",
      "text-field": "{name:latin}",
      "text-font": ["Metropolis Regular", "Noto Sans Regular"],
      "text-size": {
        base: 1.4,
        stops: [
          [0, 10],
          [3, 12],
          [4, 14],
        ],
      } as unknown as number,
      "text-transform": "uppercase",
      visibility: "visible",
    },
    paint: {
      "text-color": "rgb(117, 129, 145)",
      "text-halo-color": "rgb(242,243,240)",
      "text-halo-width": 1.4,
    },
  },
] as unknown as StyleSpecification["layers"];

// Stronger shadow contrast and exaggeration than `HILLSHADE_LAYER` in
// `darkMatterStyle.ts` (see module comment) so relief reads clearly against
// this style's light `rgb(242,243,240)` background instead of washing out.
const HILLSHADE_LAYER = {
  id: "Hillshade",
  type: "hillshade",
  source: "terrain-rgb",
  minzoom: 3,
  layout: { visibility: "visible" },
  paint: {
    "hillshade-accent-color": "hsl(98, 10%, 55%)",
    "hillshade-exaggeration": {
      stops: [
        [6, 0.7],
        [14, 0.6],
        [18, 0.45],
      ],
    } as unknown as number,
    "hillshade-highlight-color": "hsl(0, 0%, 100%)",
    "hillshade-shadow-color": "hsl(220, 15%, 35%)",
  },
} as unknown as StyleSpecification["layers"][number];

/** Builds the light theme's style, with the MapTiler API key filled in. `
 * Hillshade` is spliced in right after `background`, matching where
 * `getDarkMatterStyle` places its own hillshade layer. */
export function getPositronStyle(apiKey: string): StyleSpecification {
  return {
    version: 8,
    name: "Positron",
    sources: {
      openmaptiles: {
        type: "vector",
        url: `https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json?key=${apiKey}`,
      },
      "terrain-rgb": {
        type: "raster-dem",
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
      },
    },
    sprite: "https://openmaptiles.github.io/positron-gl-style/sprite",
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${apiKey}`,
    layers: [BASE_LAYERS[0], HILLSHADE_LAYER, ...BASE_LAYERS.slice(1)],
  };
}
