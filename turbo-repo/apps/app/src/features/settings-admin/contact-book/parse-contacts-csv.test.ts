import { describe, expect, it } from "vitest";
import { parseContactsCsv, splitBadgeNames, splitCsv } from "./parse-contacts-csv";
import type { BookContact } from "./store";

describe("splitCsv", () => {
  it("handles quoted cells with delimiters, newlines and escaped quotes", () => {
    const rows = splitCsv('a,b\n"x, y","say ""hi""\nthere"\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });

  it("detects semicolons and strips a BOM", () => {
    expect(splitCsv("﻿nombre;rut\r\nAna;1-9\r\n")).toEqual([
      ["nombre", "rut"],
      ["Ana", "1-9"],
    ]);
  });
});

describe("parseContactsCsv", () => {
  const existing: BookContact[] = [
    { id: "a", name: "Existente", phone: "", role: "", methods: [], rut: "11.111.111-1" },
  ];

  it("maps headers in any order/case/accents and marks each row", () => {
    const csv = [
      "Nombre,RUT,Descripción,Etiquetas,WhatsApp",
      "Rodrigo Seguel,12.345.678-5,Programador,transportista|mintral,+56912345678",
      "Otro,11111111-1,,,",
      ",,sin nombre,,",
      "Malo,12.345.678-0,,,",
      "Repetido,12345678-5,,,",
    ].join("\n");
    const rows = parseContactsCsv(csv, existing);
    expect(rows[0]).toEqual({
      line: 2,
      values: {
        name: "Rodrigo Seguel",
        rut: "12.345.678-5",
        description: "Programador",
        badges: "transportista|mintral",
        whatsapp: "+56912345678",
      },
      status: "ok",
    });
    expect(rows.map((r) => r.status)).toEqual([
      "ok",
      "duplicateRut",
      "missingName",
      "invalidRut",
      "duplicateInFile",
    ]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseContactsCsv("", existing)).toEqual([]);
  });
});

describe("splitBadgeNames", () => {
  it("splits on | and drops blanks", () => {
    expect(splitBadgeNames(" transportista | mintral||santiago ")).toEqual([
      "transportista",
      "mintral",
      "santiago",
    ]);
    expect(splitBadgeNames(undefined)).toEqual([]);
  });
});
