import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExportButton from "./export-button";
import type { Lugar, Trayecto } from "../places.types";

const lugar = {
  place_id: "p",
  name: "Planta",
  center: [-33, -70],
  polygon: null,
  radius_m: 50,
} as Lugar;
const trayecto = {
  trayecto_id: "t",
  name: "Ruta",
  kind: "vial",
  width_m: 30,
  points: [
    [-33, -70],
    [-33.1, -70.1],
  ],
  waypoints: null,
  parent_name: null,
  ajustado: false,
  external_id: null,
} as Trayecto;

describe("ExportButton", () => {
  it("exports what you pick, in the format you pick", () => {
    const crear = vi.fn(() => "blob:x");
    URL.createObjectURL = crear;
    URL.revokeObjectURL = vi.fn();
    const clic = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<ExportButton lugares={[lugar]} trayectos={[trayecto]} />);
    // only the download icon: the name is its label and tooltip
    const boton = screen.getByRole("button", { name: "Exportar" });
    expect(boton).toHaveTextContent("");
    expect(boton).toHaveAttribute("title", "Exportar");
    expect(boton).toHaveClass("h-full");
    fireEvent.click(boton);
    // both by default: no CSV
    expect(screen.queryByRole("button", { name: "CSV" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Descargar \(2\)/ })
    ).toBeEnabled();

    // only places: CSV appears
    fireEvent.click(screen.getByRole("button", { name: "Lugares (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    fireEvent.click(screen.getByRole("button", { name: /Descargar \(1\)/ }));
    expect(crear).toHaveBeenCalledOnce();
    expect(clic).toHaveBeenCalledOnce();
    clic.mockRestore();
  });
});
