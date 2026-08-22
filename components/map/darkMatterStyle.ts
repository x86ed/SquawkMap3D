import type { StyleSpecification } from "maplibre-gl";

/**
 * "Dark Matter" (openmaptiles/dark-matter-gl-style), adapted as the app's
 * dark theme. The upstream style ships with no elevation-aware layers at
 * all, so `Hillshade` and the `Contour`/`Glacier contour` line+label layers
 * below are ported over from MapTiler's `outdoor-v2-dark` style (this app's
 * previous dark theme) to preserve the topographic shading/contour-line look
 * — see `getDarkMatterStyle`, which splices them into the base layer stack
 * and adds the two extra sources (`terrain-rgb`, `contours`) they read from.
 * `Cliff`/`Cliff line` were left out: they read from `outdoor-v2-dark`'s
 * `maptiler_planet` vector source, a different (MapTiler-only) schema this
 * style doesn't otherwise use, and are a minor decorative detail relative to
 * the source it'd take on to port them.
 */
const BASE_LAYERS: StyleSpecification["layers"] = [
  {
    id: "background",
    type: "background",
    paint: {
      "background-color": "rgba(37, 42, 66, 1)",
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
      "fill-antialias": false,
      "fill-color": "rgb(27 ,27 ,29)",
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
      "fill-color": "rgb(12,12,12)",
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
      "fill-color": "hsl(0, 1%, 2%)",
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
      "fill-color": "hsl(0, 2%, 5%)",
      "fill-opacity": 0.4,
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
      "fill-color": "rgb(32,32,32)",
      "fill-opacity": {
        base: 0.3,
        stops: [
          [8, 0],
          [10, 0.8],
          [13, 0.4],
        ],
      } as unknown as number,
      "fill-pattern": "wood-pattern",
      "fill-translate": [0, 0],
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
      "fill-color": "rgb(32,32,32)",
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
      "text-color": "hsla(0, 0%, 0%, 0.7)",
      "text-halo-color": "hsl(0, 0%, 27%)",
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
      "fill-color": "rgb(10,10,10)",
      "fill-outline-color": "rgb(27 ,27 ,29)",
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
      "fill-color": "rgb(12,12,12)",
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
      "line-color": "rgb(12,12,12)",
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
      "line-color": "rgba(107, 107, 107, 1)",
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
      "line-color": "hsl(0, 0%, 23%)",
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
      "line-color": "hsl(0, 0%, 23%)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-blur": 1,
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-blur": 1,
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-blur": 1,
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-blur": 1,
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-blur": 1,
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-blur": 1,
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-blur": 1,
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-color": "rgba(0,0,0,0.7)",
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
      "text-color": "rgb(101,101,101)",
      "text-halo-color": "rgba(0,0,0,0.7)",
      "text-halo-width": 1.4,
    },
  },
] as unknown as StyleSpecification["layers"];

// Ported from `outdoor-v2-dark` (see module comment) so 3D terrain reads
// consistently in 2D too, at any pitch — colors nudged for the darker,
// low-saturation "Dark Matter" backdrop.
const HILLSHADE_LAYER = {
  id: "Hillshade",
  type: "hillshade",
  source: "terrain-rgb",
  minzoom: 3,
  layout: { visibility: "visible" },
  paint: {
    "hillshade-accent-color": "hsl(98, 10%, 8%)",
    "hillshade-exaggeration": {
      stops: [
        [6, 0.4],
        [14, 0.35],
        [18, 0.25],
      ],
    } as unknown as number,
    "hillshade-highlight-color": "hsl(220, 10%, 45%)",
    "hillshade-shadow-color": "hsl(9, 0%, 0%)",
  },
} as unknown as StyleSpecification["layers"][number];

const CONTOUR_LAYERS: StyleSpecification["layers"] = [
  {
    id: "Contour index",
    type: "line",
    source: "contours",
    "source-layer": "contour",
    minzoom: 10,
    layout: { visibility: "visible" },
    paint: {
      "line-color": "hsl(220, 12%, 40%)",
      "line-opacity": [
        "interpolate",
        ["exponential", 1],
        ["zoom"],
        9,
        0.15,
        14,
        0.3,
        18,
        0.4,
      ],
      "line-width": ["interpolate", ["exponential", 1], ["zoom"], 10, 1, 14, 1.5],
    },
    filter: ["all", ["in", "nth_line", 5, 10], ["!has", "glacier"]],
  },
  {
    id: "Glacier contour index",
    type: "line",
    source: "contours",
    "source-layer": "contour",
    minzoom: 10,
    layout: { visibility: "visible" },
    paint: {
      "line-color": "hsl(200, 40%, 35%)",
      "line-opacity": [
        "interpolate",
        ["exponential", 1],
        ["zoom"],
        9,
        0.15,
        14,
        0.3,
        18,
        0.4,
      ],
      "line-width": {
        stops: [
          [10, 0.8],
          [14, 1.3],
        ],
      } as unknown as number,
    },
    filter: ["all", ["in", "nth_line", 5, 10], ["==", "glacier", 1]],
  },
  {
    id: "Contour",
    type: "line",
    source: "contours",
    "source-layer": "contour",
    minzoom: 11,
    layout: { "line-cap": "square", visibility: "visible" },
    paint: {
      "line-color": "hsl(220, 12%, 48%)",
      "line-opacity": [
        "step",
        ["zoom"],
        ["match", ["get", "nth_line"], 0, 0, 0.15],
        15,
        0.15,
      ],
      "line-width": 0.8,
    },
    filter: ["all", ["!in", "nth_line", 5, 10], ["!has", "glacier"]],
  },
  {
    id: "Glacier contour",
    type: "line",
    source: "contours",
    "source-layer": "contour",
    minzoom: 11,
    layout: { "line-cap": "square", visibility: "visible" },
    paint: {
      "line-color": "hsl(200, 40%, 40%)",
      "line-opacity": [
        "step",
        ["zoom"],
        ["match", ["get", "nth_line"], 0, 0, 0.2],
        15,
        0.2,
      ],
      "line-width": 0.8,
    },
    filter: ["all", ["!in", "nth_line", 5, 10], ["==", "glacier", 1]],
  },
  {
    id: "Contour labels",
    type: "symbol",
    source: "contours",
    "source-layer": "contour",
    minzoom: 12,
    layout: {
      "symbol-avoid-edges": true,
      "symbol-placement": "line",
      "text-allow-overlap": false,
      "text-field": "{height}",
      "text-font": ["Metropolis Medium Italic", "Noto Sans Italic"],
      "text-ignore-placement": false,
      "text-padding": 1,
      "text-rotation-alignment": "map",
      "text-size": {
        base: 1,
        stops: [
          [12, 8],
          [20, 12],
        ],
      } as unknown as number,
      visibility: "visible",
    },
    paint: {
      "icon-color": "hsl(220, 10%, 45%)",
      "text-color": "hsl(220, 10%, 45%)",
      "text-halo-blur": 1,
      "text-halo-color": "hsl(0,0%,0%)",
      "text-halo-width": 0.5,
    },
    filter: [
      "all",
      ["==", "$type", "LineString"],
      [">", "height", 0],
      ["in", "nth_line", 5, 10],
      ["!has", "glacier"],
    ],
  },
  {
    id: "Glacier contour labels",
    type: "symbol",
    source: "contours",
    "source-layer": "contour",
    minzoom: 12,
    layout: {
      "symbol-avoid-edges": true,
      "symbol-placement": "line",
      "text-allow-overlap": false,
      "text-field": "{height}",
      "text-font": ["Metropolis Medium Italic", "Noto Sans Italic"],
      "text-ignore-placement": false,
      "text-padding": 1,
      "text-rotation-alignment": "map",
      "text-size": {
        base: 1,
        stops: [
          [12, 8],
          [20, 12],
        ],
      } as unknown as number,
      visibility: "visible",
    },
    paint: {
      "icon-color": "hsl(201, 25%, 40%)",
      "text-color": "hsl(201, 25%, 40%)",
      "text-halo-blur": 1,
      "text-halo-color": "hsl(0,0%,0%)",
      "text-halo-width": 0.5,
    },
    filter: [
      "all",
      ["==", "$type", "LineString"],
      [">", "height", 0],
      ["in", "nth_line", 5, 10],
      ["has", "glacier"],
    ],
  },
] as unknown as StyleSpecification["layers"];

/** Builds the dark theme's style, with the MapTiler API key filled in and
 * the topographic layers (see module comment) spliced into the base stack:
 * `Hillshade` right after `background` (so it shades everything painted on
 * top of it, matching where `outdoor-v2-dark` places it relative to land
 * cover), and the contour lines/labels after `landuse_park` and before
 * `water_name` (above flat land colors, below water/building/road/label
 * layers) — mirroring `outdoor-v2-dark`'s relative ordering. */
export function getDarkMatterStyle(apiKey: string): StyleSpecification {
  const parkIndex = BASE_LAYERS.findIndex((layer) => layer.id === "landuse_park");

  const layers: StyleSpecification["layers"] = [
    BASE_LAYERS[0],
    HILLSHADE_LAYER,
    ...BASE_LAYERS.slice(1, parkIndex + 1),
    ...CONTOUR_LAYERS,
    ...BASE_LAYERS.slice(parkIndex + 1),
  ];

  return {
    version: 8,
    name: "Dark Matter",
    sources: {
      openmaptiles: {
        type: "vector",
        url: `https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json?key=${apiKey}`,
      },
      "terrain-rgb": {
        type: "raster-dem",
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
      },
      contours: {
        type: "vector",
        url: `https://api.maptiler.com/tiles/contours-v2/tiles.json?key=${apiKey}`,
      },
    },
    sprite: "https://openmaptiles.github.io/dark-matter-gl-style/sprite",
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${apiKey}`,
    layers,
  };
}
