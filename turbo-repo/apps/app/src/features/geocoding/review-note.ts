import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";

/** A resolver note (English, from the modulith) and the dictionary key that says it in the user's language. */
const NOTES: ReadonlyArray<{
  pattern: RegExp;
  key: string;
  params: readonly string[];
}> = [
  {
    pattern: /^the point is in (.+) \((\w+)\), not in (.+) \((\w+)\)$/,
    key: "pointInOtherDistrict",
    params: ["found", "foundCode", "declared", "declaredCode"],
  },
  {
    pattern: /^the point is outside (\w{2}), not in (.+) \((\w+)\)$/,
    key: "pointOutsideCountry",
    params: ["country", "declared", "declaredCode"],
  },
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
    pattern: /^district code (.+) not found in (\w{2})$/,
    key: "districtCodeNotFound",
    params: ["district", "country"],
  },
  {
    pattern: /^district (.+) is ambiguous in (\w{2}); send its code$/,
    key: "districtAmbiguous",
    params: ["district", "country"],
  },
  {
    pattern: /^district (.+) not found in (\w{2})$/,
    key: "districtNotFound",
    params: ["district", "country"],
  },
  {
    pattern: /^district (.+) has no boundary to check against$/,
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
    pattern: /^(\w+) found only (.+), not an address$/,
    key: "providerFoundCoarser",
    params: ["provider", "type"],
  },
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  for (const { pattern, key, params } of NOTES) {
    const match = pattern.exec(note);
    if (!match) continue;
    const values = Object.fromEntries(
      params.map((name, i) => {
        const value = match[i + 1] ?? "";
        return [name, name === "provider" ? capitalize(value) : value];
      })
    );
    const text = trDynamic(key, notes, values);
    return text === key ? note : text;
  }
  return note;
}
