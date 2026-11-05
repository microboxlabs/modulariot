import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TrayectoList } from "./route-lists";
import type { Trayecto } from "../places.types";

const trayecto: Trayecto = {
  trayecto_id: "local-t1",
  name: "Acceso norte",
  kind: "vial",
  width_m: 30,
  points: [
    [0, 0],
    [1, 1],
  ],
  waypoints: null,
  parent_name: null,
  ajustado: true,
  external_id: null,
};

describe("route lists", () => {
  it("routes use the shared card: header, details and menu", () => {
    const onEditar = vi.fn();
    const onEliminar = vi.fn();
    render(
      <TrayectoList
        trayectos={[trayecto]}
        seleccionadoId={null}
        onIr={vi.fn()}
        onEditar={onEditar}
        onEliminar={onEliminar}
      />
    );
    expect(screen.getByText("Trayectos")).toBeInTheDocument();
    expect(
      screen.getByText("vial · ajustado · 30 m · 2 pts")
    ).toBeInTheDocument();
    expect(screen.queryByText("local")).toBeNull();

    fireEvent.click(screen.getByLabelText("Opciones de Acceso norte"));
    fireEvent.click(screen.getByText("Eliminar"));
    expect(onEliminar).toHaveBeenCalledWith(trayecto);
  });

  it("collapses the Trayectos section from the expandable header", () => {
    render(
      <TrayectoList
        trayectos={[trayecto]}
        seleccionadoId={null}
        onIr={vi.fn()}
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
      />
    );
    expect(screen.getByText("Acceso norte")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Ocultar Trayectos"));
    expect(screen.queryByText("Acceso norte")).toBeNull();
    fireEvent.click(screen.getByLabelText("Mostrar Trayectos"));
    expect(screen.getByText("Acceso norte")).toBeInTheDocument();
  });
});
