import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import enDictionary from "@/lang/en.json";
import esDictionary from "@/lang/es.json";
import UnsavedChangesDialog from "../ui/unsaved-changes-dialog";
import { PlacesI18nProvider, textosLugares } from "./places-i18n";

const nada = () => {};

describe("Lugares texts", () => {
  it("come from the page dictionary, in its language", () => {
    render(
      <PlacesI18nProvider dict={enDictionary}>
        <UnsavedChangesDialog abierto onSalir={nada} onSeguir={nada} />
      </PlacesI18nProvider>
    );
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("Leave without saving")).toBeInTheDocument();
  });

  it("fill in their parameters, numbers included", () => {
    expect(textosLugares(enDictionary)("export.download", { n: 3 })).toBe(
      "Download (3)"
    );
    expect(textosLugares(esDictionary)("export.download", { n: 3 })).toBe(
      "Descargar (3)"
    );
  });

  it("have every Spanish key in English too", () => {
    const hojas = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null ? hojas(v, `${p}${k}.`) : [p + k]
      );
    expect(hojas(enDictionary.places).sort()).toEqual(
      hojas(esDictionary.places).sort()
    );
  });
});
