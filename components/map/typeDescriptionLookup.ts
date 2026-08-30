import typeDescriptions from "./data/typeDescriptions.json";

let descriptionByIcao: Map<string, string> | null = null;

function getDescriptionByIcao(): Map<string, string> {
  if (!descriptionByIcao) {
    descriptionByIcao = new Map(
      (typeDescriptions as Array<{ icao: string; description: string }>).map((row) => [
        row.icao,
        row.description,
      ]),
    );
  }
  return descriptionByIcao;
}

/**
 * Resolves an ICAO aircraft type designator (e.g. "A320", "B738" — the same
 * value rendered by the Type column, `Aircraft.typeDesignator`) to its
 * decoded description (e.g. "Airbus A320"), via a vendored table
 * (`data/typeDescriptions.json`, built from OpenFlights' `planes.dat` — see
 * scripts/generate-type-descriptions.mjs). Used only by the Filters tab's
 * Type description filter (design.md Decision 14), not rendered as a table
 * column, matching tar1090's own behavior. Returns `null` for a missing/
 * empty designator or one with no matching entry — never throws, mirroring
 * this app's other lookup-with-no-match-returns-null helpers (e.g.
 * `airlineNameForCallsign`).
 */
export function typeDescriptionForCode(typeDesignator: string | undefined): string | null {
  if (!typeDesignator) return null;
  const normalized = typeDesignator.trim().toUpperCase();
  if (!normalized) return null;
  return getDescriptionByIcao().get(normalized) ?? null;
}
