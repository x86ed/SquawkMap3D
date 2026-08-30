import registrationPrefixes from "./data/registrationPrefixes.json";

interface RegistrationPrefixRow {
  prefix: string;
  countryCode: string;
}

let prefixesByLengthDesc: RegistrationPrefixRow[] | null = null;

function getPrefixesByLengthDesc(): RegistrationPrefixRow[] {
  if (!prefixesByLengthDesc) {
    prefixesByLengthDesc = (registrationPrefixes as RegistrationPrefixRow[])
      .slice()
      .sort((a, b) => b.prefix.length - a.prefix.length);
  }
  return prefixesByLengthDesc;
}

/**
 * Resolves a tail number/registration (e.g. "N12345", "G-ABCD", "VH-ABC")
 * to its ISO 3166-1 alpha-2 country code, via a vendored tail-number-prefix
 * table (`data/registrationPrefixes.json`, built from Wikipedia's "List of
 * aircraft registration prefixes" — see scripts/generate-registration-
 * prefixes.mjs). Matches the longest known prefix the registration starts
 * with (checked longest-first) so multi-character prefixes like "VP-B"
 * aren't shadowed by a shorter single-letter match. Returns `null` for no
 * registration or no matching prefix — a handful of real-world prefixes are
 * shared by more than one country (see the generator script's header
 * comment) and only resolve to one of them; an unmatched/ambiguous
 * registration renders no flag rather than a wrong one.
 */
export function countryCodeForRegistration(registration: string | undefined): string | null {
  if (!registration) return null;
  const normalized = registration.trim().toUpperCase();
  if (!normalized) return null;

  for (const { prefix, countryCode } of getPrefixesByLengthDesc()) {
    if (normalized.startsWith(prefix)) return countryCode;
  }
  return null;
}

let regionDisplayNames: Intl.DisplayNames | null | undefined;

function getRegionDisplayNames(): Intl.DisplayNames | null {
  if (regionDisplayNames === undefined) {
    try {
      regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionDisplayNames = null;
    }
  }
  return regionDisplayNames;
}

/**
 * Resolves an ISO 3166-1 alpha-2 country code to its full English name, for
 * the Country-of-registration filter (design.md Decision 14) — matching
 * against either the code or this name. Uses `Intl.DisplayNames` (same
 * technique `airportPopup.ts`'s own `countryNameForCode` already uses for
 * the reverse direction), rather than vendoring a second copy of ISO
 * 3166-1's ~250 country names alongside `registrationPrefixes.json`. Unlike
 * `airportPopup.ts`'s version, this returns `null` (not the raw code) when
 * unresolved, so an unresolved code doesn't create a bogus text match in the
 * filter.
 */
export function countryNameForCode(code: string | undefined): string | null {
  if (!code) return null;
  const displayNames = getRegionDisplayNames();
  if (!displayNames) return null;
  try {
    const resolved = displayNames.of(code);
    return resolved && resolved !== code ? resolved : null;
  } catch {
    return null;
  }
}
