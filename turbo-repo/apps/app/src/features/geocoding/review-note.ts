import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";

const EXACT_NOTES: ReadonlyMap<string, string> = new Map([
  [
    "the address names no district and is not in the internal addresses",
    "addressWithoutDistrict",
  ],
  ["district code is too long", "districtCodeTooLong"],
  ["district name is too long", "districtNameTooLong"],
  ["geocoding: the platform has no geocoding provider", "noPlatformProvider"],
  [
    "geocoding: this organization's geocoding connection cannot be read",
    "connectionUnreadable",
  ],
  [
    "geocoding: this organization's geocoding connection is not managed by the platform",
    "connectionUnmanaged",
  ],
  ["geocoding: no organization to geocode for", "noOrganization"],
  [
    "geocoding: the geocoding connection's costPerRequestUsd is not a number",
    "costInvalid",
  ],
  [
    "geocoding: the geocoding connection's credential has no token",
    "credentialWithoutToken",
  ],
  ["geocoding: interrupted", "geocodingInterrupted"],
]);

/** A resolver note (English, from the modulith) and the dictionary key that says it in the user's language. */
const NOTES: ReadonlyArray<{
  pattern: RegExp;
  key: string;
  params: readonly string[];
}> = [
  {
    pattern: /^country is required to check the district$/,
    key: "countryRequired",
    params: [],
  },
  {
    pattern: /^country (\w{2}) has no district boundaries$/,
    key: "countryWithoutBoundaries",
    params: ["country"],
  },
  { pattern: /^district is required$/, key: "districtRequired", params: [] },
  {
    pattern: /^district code ([^\r\n]+) not found in (\w{2})$/,
    key: "districtCodeNotFound",
    params: ["district", "country"],
  },
  {
    pattern: /^district ([^\r\n]+) is ambiguous in (\w{2}); send its code$/,
    key: "districtAmbiguous",
    params: ["district", "country"],
  },
  {
    pattern: /^district ([^\r\n]+) not found in (\w{2})$/,
    key: "districtNotFound",
    params: ["district", "country"],
  },
  {
    pattern: /^district ([^\r\n]+) has no boundary to check against$/,
    key: "districtWithoutBoundary",
    params: ["district"],
  },
  {
    pattern: /^no geofence, plus code or coordinates$/,
    key: "noSource",
    params: [],
  },
  {
    pattern: /^an address needs a district with a boundary to be geocoded$/,
    key: "addressNeedsDistrict",
    params: [],
  },
  {
    pattern: /^a short plus code needs a district with a boundary$/,
    key: "shortPlusCodeNeedsDistrict",
    params: [],
  },
  {
    pattern: /^plus code (\S+) is not valid$/,
    key: "plusCodeInvalid",
    params: ["plusCode"],
  },
  {
    pattern: /^latitude and longitude go together$/,
    key: "latitudeLongitudeTogether",
    params: [],
  },
  {
    pattern: /^coordinates out of range$/,
    key: "coordinatesOutOfRange",
    params: [],
  },
  {
    pattern: /^could not check geofences for the point$/,
    key: "geofenceCheckFailed",
    params: [],
  },
  {
    pattern: /^the GPS database is not configured$/,
    key: "gpsNotConfigured",
    params: [],
  },
  {
    pattern:
      /^geocoding: the organization used its (\d+) geocoding resolutions for this month$/,
    key: "quotaUsed",
    params: ["quota"],
  },
  {
    pattern: /^geocoding: the organization has no geocoding plan$/,
    key: "noPlan",
    params: [],
  },
  {
    pattern: /^geocoding: unknown geocoding provider ([^\r\n]+)$/,
    key: "unknownProvider",
    params: ["provider"],
  },
  {
    pattern: /^geocoding: the geocoding connection must use (\S+)$/,
    key: "connectionBaseUrl",
    params: ["baseUrl"],
  },
  {
    pattern: /^geocoding: this organization has no geocoding connection/,
    key: "noConnection",
    params: [],
  },
  {
    pattern: /^geocoding results cannot be stored/,
    key: "notStorable",
    params: [],
  },
  {
    pattern: /^(\w+) found nothing, not an address$/,
    key: "providerFoundNothing",
    params: ["provider"],
  },
  {
    pattern: /^(\w+) found only ([^\r\n]+), not an address$/,
    key: "providerFoundCoarser",
    params: ["provider", "type"],
  },
];

function namedDistrict(value: string) {
  const open = value.lastIndexOf(" (");
  if (open < 1 || !value.endsWith(")")) return null;
  const name = value.slice(0, open);
  const code = value.slice(open + 2, -1);
  if (name.includes("\n") || name.includes("\r") || !/^\w+$/.test(code)) {
    return null;
  }
  return { name, code };
}

function pointNote(
  note: string
): { key: string; values: Record<string, string> } | null {
  const separator = ", not in ";
  const split = note.lastIndexOf(separator);
  if (split === -1) return null;
  const declared = namedDistrict(note.slice(split + separator.length));
  if (!declared) return null;
  const found = note.slice(0, split);
  const inDistrict = "the point is in ";
  if (found.startsWith(inDistrict)) {
    const district = namedDistrict(found.slice(inDistrict.length));
    if (!district) return null;
    return {
      key: "pointInOtherDistrict",
      values: {
        found: district.name,
        foundCode: district.code,
        declared: declared.name,
        declaredCode: declared.code,
      },
    };
  }
  const outsideCountry = "the point is outside ";
  if (!found.startsWith(outsideCountry)) return null;
  const country = found.slice(outsideCountry.length);
  if (!/^\w{2}$/.test(country)) return null;
  return {
    key: "pointOutsideCountry",
    values: { country, declared: declared.name, declaredCode: declared.code },
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function translatedNote(
  note: string,
  notes: I18nRecord,
  key: string,
  values?: Record<string, string>
): string {
  const text = trDynamic(key, notes, values);
  return text === key ? note : text;
}

/**
 * The note in the user's language when it is one the resolver writes; otherwise the note as it came, so a new or
 * provider-specific note still shows.
 */
export function reviewNote(
  note: string,
  notes: I18nRecord | undefined
): string {
  if (!notes) return note;
  const exact = EXACT_NOTES.get(note);
  if (exact) return translatedNote(note, notes, exact);
  const point = pointNote(note);
  if (point) {
    return translatedNote(note, notes, point.key, point.values);
  }
  for (const { pattern, key, params } of NOTES) {
    const match = pattern.exec(note);
    if (!match) continue;
    const values = Object.fromEntries(
      params.map((name, i) => {
        const value = match[i + 1] ?? "";
        return [name, name === "provider" ? capitalize(value) : value];
      })
    );
    return translatedNote(note, notes, key, values);
  }
  return note;
}
