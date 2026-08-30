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
