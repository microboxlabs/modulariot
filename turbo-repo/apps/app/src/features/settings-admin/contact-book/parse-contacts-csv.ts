/**
 * PROTOTYPE — reads the contact-book import CSV. Fixed columns (header row
 * required, any order, case/accent-insensitive, Spanish or English names):
 * nombre, descripcion, rut, empresa, cargo, etiquetas, telefono, whatsapp,
 * meet, teams. Comma or semicolon separated (Excel in Spanish uses `;`).
 * `etiquetas` holds several badges separated by `|`
 * ("transportista|norte|santiago").
 */

import type { CallMethod } from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import { checkRut, normalizeRut } from "./contact-duplicates";
import type { BookContact } from "./store";
import { normalizeLabel } from "./taxonomy-store";

export type ImportField =
  | "name"
  | "description"
  | "rut"
  | "company"
  | "position"
  | "badges"
  | CallMethod;

/** Column order used for the example table and the downloadable layout. */
export const IMPORT_COLUMNS: readonly { field: ImportField; header: string }[] =
  [
    { field: "name", header: "nombre" },
    { field: "description", header: "descripcion" },
    { field: "rut", header: "rut" },
    { field: "company", header: "empresa" },
    { field: "position", header: "cargo" },
    { field: "badges", header: "etiquetas" },
    { field: "phone", header: "telefono" },
    { field: "whatsapp", header: "whatsapp" },
    { field: "meet", header: "meet" },
    { field: "teams", header: "teams" },
  ];

const HEADER_ALIASES: Record<string, ImportField> = {
  nombre: "name",
  name: "name",
  descripcion: "description",
  description: "description",
  rut: "rut",
  empresa: "company",
  company: "company",
  cargo: "position",
  position: "position",
  etiquetas: "badges",
  badges: "badges",
  tags: "badges",
  descriptores: "badges",
  telefono: "phone",
  phone: "phone",
  whatsapp: "whatsapp",
  meet: "meet",
  "google meet": "meet",
  teams: "teams",
  "microsoft teams": "teams",
};

/** Splits an `etiquetas` cell into badge names. */
export function splitBadgeNames(cell: string | undefined): string[] {
  return (cell ?? "")
    .split("|")
    .map((name) => name.trim())
    .filter(Boolean);
}

export type ImportRowStatus =
  | "ok"
  | "missingName"
  | "invalidRut"
  | "duplicateRut"
  | "duplicateInFile";

export interface ImportRow {
  /** 1-based line in the file, for pointing the user at problems. */
  line: number;
  values: Partial<Record<ImportField, string>>;
  status: ImportRowStatus;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = headerLine.split(";").length;
  const commas = headerLine.split(",").length;
  return semicolons > commas ? ";" : ",";
}

/** Reads a quoted cell body from `start` up to its closing quote (`end`),
 *  turning `""` into `"`. */
function readQuoted(
  text: string,
  start: number
): { value: string; end: number } {
  let value = "";
  let i = start;
  while (i < text.length) {
    if (text[i] === '"' && text[i + 1] === '"') {
      value += '"';
      i += 2;
    } else if (text[i] === '"') {
      return { value, end: i };
    } else {
      value += text[i];
      i++;
    }
  }
  return { value, end: i };
}

/** Splits CSV text into rows of cells, honouring double-quoted cells
 *  (which may contain the delimiter, newlines and `""` escapes). */
export function splitCsv(text: string): string[][] {
  const clean = text.startsWith("﻿") ? text.slice(1) : text;
  const firstBreak = clean.indexOf("\n");
  const delimiter = detectDelimiter(
    firstBreak === -1 ? clean : clean.slice(0, firstBreak)
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";

  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (ch === '"') {
      const quoted = readQuoted(clean, i + 1);
      cell += quoted.value;
      i = quoted.end;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
    i++;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function rowStatus(
  values: Partial<Record<ImportField, string>>,
  contacts: readonly BookContact[],
  seenRuts: Set<string>
): ImportRowStatus {
  if (!values.name) return "missingName";
  const rut = values.rut ?? "";
  const check = checkRut(rut, contacts);
  if (check.problem === "invalid") return "invalidRut";
  if (check.problem === "duplicate") return "duplicateRut";
  const normalized = normalizeRut(rut);
  if (normalized && seenRuts.has(normalized)) return "duplicateInFile";
  if (normalized) seenRuts.add(normalized);
  return "ok";
}

/** Parses the file and marks each row: only "ok" rows get imported. */
export function parseContactsCsv(
  text: string,
  contacts: readonly BookContact[]
): ImportRow[] {
  const [header, ...body] = splitCsv(text);
  if (!header) return [];
  const fields = header.map((h) => HEADER_ALIASES[normalizeLabel(h)]);
  const seenRuts = new Set<string>();

  return body.map((cells, index) => {
    const values: Partial<Record<ImportField, string>> = {};
    fields.forEach((field, col) => {
      const value = cells[col]?.trim();
      if (field && value) values[field] = value;
    });
    return {
      line: index + 2,
      values,
      status: rowStatus(values, contacts, seenRuts),
    };
  });
}
