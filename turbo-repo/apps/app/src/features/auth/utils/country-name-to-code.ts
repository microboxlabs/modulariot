import type { Country } from "react-phone-number-input";
import en from "react-phone-number-input/locale/en.json";

// A handful of names in COUNTRIES (countries.constants.ts) don't match
// react-phone-number-input's English locale strings verbatim — mapped here
// by hand since there are only a few.
const NAME_ALIASES: Record<string, string> = {
  Brunei: "Brunei Darussalam",
  "Cabo Verde": "Cape Verde",
  Czechia: "Czech Republic",
  "Democratic Republic of the Congo": "Congo, Democratic Republic of the",
  Eswatini: "Swaziland",
  "Ivory Coast": "Cote d'Ivoire",
  Micronesia: "Federated States of Micronesia",
  "Vatican City": "Holy See (Vatican City State)",
};

const NON_COUNTRY_KEYS = new Set(["ext", "country", "phone"]);

const CODE_BY_NAME: Record<string, Country> = Object.fromEntries(
  Object.entries(en)
    .filter(([code]) => !NON_COUNTRY_KEYS.has(code))
    .map(([code, name]) => [name, code as Country])
);

/** Resolves a COUNTRIES display name (e.g. "Chile") to its ISO 3166-1 alpha-2 code (e.g. "CL"), for use as a phone input's `defaultCountry`. */
export function countryNameToCode(name: string): Country | undefined {
  return CODE_BY_NAME[NAME_ALIASES[name] ?? name];
}
