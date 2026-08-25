import type { Map as MapLibreMap } from "maplibre-gl";

type IdResolver = (id: string) => Promise<void> | undefined;

/**
 * `map.setMissingStyleImageResolver()` is a single-slot API — each call
 * replaces whatever resolver was installed before it, not adds to it. This
 * app has more than one module that needs to resolve its own icon ids on
 * demand (airports, the user-location marker), and each used to call
 * `setMissingStyleImageResolver` directly, so whichever one ran last on a
 * given `style.load` silently clobbered the other (its resolver would then
 * return `undefined` for ids it doesn't own, and MapLibre logs "Image ...
 * could not be loaded" and never renders that layer's icons).
 *
 * This keeps one dispatcher per map instance, keyed by caller-chosen `key`
 * strings so a caller re-registering on every `style.load` (idempotent, as
 * each of these modules already documents) updates its own entry in place
 * rather than appending duplicates.
 */
const resolversByMap = new WeakMap<MapLibreMap, Map<string, IdResolver>>();

export function setMissingImageResolver(
  map: MapLibreMap,
  key: string,
  resolver: IdResolver,
): void {
  let byKey = resolversByMap.get(map);
  if (!byKey) {
    byKey = new Map();
    resolversByMap.set(map, byKey);
  }
  const isFirstRegistration = byKey.size === 0;
  byKey.set(key, resolver);

  if (isFirstRegistration) {
    map.setMissingStyleImageResolver((id) => {
      for (const resolve of resolversByMap.get(map)?.values() ?? []) {
        const result = resolve(id);
        if (result !== undefined) return result;
      }
      return undefined;
    });
  }
}
