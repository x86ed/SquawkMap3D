import airlineDesignators from "./data/airlineDesignators.json";

let nameByIcao: Map<string, string> | null = null;

function getNameByIcao(): Map<string, string> {
  if (!nameByIcao) {
    nameByIcao = new Map(
      (airlineDesignators as Array<{ icao: string; name: string }>).map((row) => [
        row.icao,
        row.name,
      ]),
    );
  }
  return nameByIcao;
}

const ICAO_CALLSIGN_PREFIX_PATTERN = /^[A-Z]{3}/;

/**
 * Resolves a flight callsign (e.g. "UAL123") to its operating airline's
 * name via the leading 3-letter ICAO airline designator prefix, looked up
 * in a vendored table (`data/airlineDesignators.json`, built from
 * OpenFlights' `airlines.dat` — see
 * scripts/generate-airline-designators.mjs). Purely local/synchronous, no
 * network request (design.md Decision 9). Returns `null` for a missing/
 * empty callsign, or one whose leading 3 characters aren't letters, or
 * whose prefix has no match (general aviation tail-number-as-callsign,
 * unlisted operator, etc.) — never throws, mirroring this app's other
 * lookup-with-no-match-returns-null helpers (e.g. `countryCodeForRegistration`).
 */
export function airlineNameForCallsign(callsign: string | undefined): string | null {
  if (!callsign) return null;
  const normalized = callsign.trim().toUpperCase();
  const match = normalized.match(ICAO_CALLSIGN_PREFIX_PATTERN);
  if (!match) return null;
  return getNameByIcao().get(match[0]) ?? null;
}
