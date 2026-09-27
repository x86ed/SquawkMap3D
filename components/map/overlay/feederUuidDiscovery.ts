/**
 * Auto-populates the adsb.win feeder UUID (`feederUuid.ts`) from the local
 * ADS-B feeder box's own admin UI, so the user never has to type it in by
 * hand (openspec/changes/auto-load-feeder-uuid). This app has no
 * server-side runtime (static export — see
 * openspec/changes/deploy-to-feeder/design.md), so the actual cross-network
 * request happens server-to-server inside `scripts/squawkmap3d.nginx.conf`'s
 * `/feeder-config/aggregators` proxy; this module only fetches that
 * same-origin path and parses the result.
 *
 * Upstream (dirkhh/adsb-feeder-image) server-renders that page with, per
 * aggregator, an input `name="{identifier}--ultrafeeder--uuid" value="...">`
 * — adsb.win's identifier is the fixed string `adsbwin`
 * (`utils/data.py`'s `NetConfig(identifier="adsbwin", ...)`), so this
 * pattern is stable across any box running that stock feeder image.
 */
import { getStoredFeederUuid, storeFeederUuid } from "./feederUuid";

const AGGREGATORS_PROXY_PATH = "/feeder-config/aggregators";

const ADSBWIN_UUID_FIELD_PATTERN =
  /name="adsbwin--ultrafeeder--uuid"[^>]*\svalue="([^"]*)"|value="([^"]*)"[^>]*\sname="adsbwin--ultrafeeder--uuid"/;

/** Never throws — any failure (network, non-2xx, no match) resolves to `null`. */
export async function discoverFeederUuid(): Promise<string | null> {
  try {
    const response = await fetch(AGGREGATORS_PROXY_PATH);
    if (!response.ok) return null;

    const html = await response.text();
    const match = ADSBWIN_UUID_FIELD_PATTERN.exec(html);
    const uuid = (match?.[1] ?? match?.[2] ?? "").trim();
    return uuid === "" ? null : uuid;
  } catch {
    return null;
  }
}

/**
 * Called once on `MapView` mount (design.md's Decision 4). No-ops — never
 * calls `discoverFeederUuid()` at all — whenever a UUID is already stored
 * (manually entered or from a previous autodiscovery), so this never
 * overwrites an existing value.
 */
export async function autoDiscoverFeederUuidIfUnset(): Promise<void> {
  if (getStoredFeederUuid()) return;
  const uuid = await discoverFeederUuid();
  if (uuid) storeFeederUuid(uuid);
}
