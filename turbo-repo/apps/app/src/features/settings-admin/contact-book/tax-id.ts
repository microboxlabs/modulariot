import { isRutValid } from "@/utils/rut";
import { displayRut, maskRut, normalizeRut } from "./contact-duplicates";

/** A person's document: RUT (Chile), DNI or CE (Peru), passport or another. */
export const PERSON_ID_TYPES = [
  "RUT",
  "DNI",
  "CE",
  "PASAPORTE",
  "OTRO",
] as const;
/** A company's tax id: RUT (Chile), RUC (Peru) or another. */
export const COMPANY_ID_TYPES = ["RUT", "RUC", "OTRO"] as const;

export type IdType = (typeof PERSON_ID_TYPES)[number] | "RUC";

export const ID_PLACEHOLDER: Record<IdType, string> = {
  RUT: "12.345.678-5",
  DNI: "12345678",
  CE: "001234567",
  PASAPORTE: "",
  OTRO: "",
  RUC: "20123456789",
};

/** Upper case, without dots, dashes or spaces. */
export function normalizeId(value: string): string {
  return normalizeRut(value);
}

/** The id as it is typed, in the shape of its type: a RUT with dots and dash, a DNI or RUC digits only. */
export function maskId(type: IdType, typed: string): string {
  switch (type) {
    case "RUT":
      return maskRut(typed);
    case "DNI":
      return typed.replaceAll(/\D/g, "").slice(0, 8);
    case "RUC":
      return typed.replaceAll(/\D/g, "").slice(0, 11);
    case "CE":
      return typed
        .toUpperCase()
        .replaceAll(/[^0-9A-Z]/g, "")
        .slice(0, 12);
    default:
      return typed
        .toUpperCase()
        .replaceAll(/[^0-9A-Z.-]/g, "")
        .slice(0, 32);
  }
}

/** Peru's RUC: 11 digits starting 10, 15, 17 or 20, with a mod-11 check digit. */
export function isRucValid(value: string): boolean {
  const ruc = normalizeId(value);
  if (!/^(10|15|17|20)\d{9}$/.test(ruc)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + Number(ruc[i]) * w, 0);
  let check = 11 - (sum % 11);
  if (check === 10) check = 0;
  else if (check === 11) check = 1;
  return Number(ruc[10]) === check;
}

/** The checks the API makes for each type. */
export function isIdValid(type: IdType, value: string): boolean {
  const id = normalizeId(value);
  switch (type) {
    case "RUT":
      return isRutValid(id);
    case "RUC":
      return isRucValid(id);
    case "DNI":
      return /^\d{8}$/.test(id);
    case "CE":
      return /^[A-Z0-9]{8,12}$/.test(id);
    default:
      return /^[A-Z0-9]{1,32}$/.test(id);
  }
}

/** A stored id for reading: a RUT with dots and dash, the others as stored. */
export function displayId(type: string | undefined, value: string): string {
  return !type || type === "RUT" ? displayRut(value) : normalizeId(value);
}

/** The type of a company tax id that came without one, such as a carrier's. */
export function guessCompanyIdType(value: string): IdType {
  if (isRutValid(normalizeId(value))) return "RUT";
  if (isRucValid(value)) return "RUC";
  return "OTRO";
}

export function asIdType(value: string | null | undefined): IdType {
  return [...PERSON_ID_TYPES, "RUC"].includes(value as IdType)
    ? (value as IdType)
    : "RUT";
}
