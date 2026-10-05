import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CircuitoList, TrayectoList } from "./route-lists";
import type { Circuito, Trayecto } from "./places.types";

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

const circuito: Circuito = {
  route_id: "c1",
  name: "Ronda puerto",
  via_label: null,
  cerrado: true,
  ajustado: false,
  path_points: null,
  stops: [
    { place_id: "a", name: "Planta", stop_kind: "origen", center: [0, 0] },
    { place_id: "b", name: "Puerto", stop_kind: "destino", center: [1, 1] },
  ],
};

describe("route lists", () => {
  it("routes use the shared card: header, details, local badge and menu", () => {
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
    expect(screen.getByText("local")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Opciones de Acceso norte"));
    fireEvent.click(screen.getByText("Eliminar"));
    expect(onEliminar).toHaveBeenCalledWith(trayecto);
  });

  it("circuits list their stops and open from the menu", () => {
    const onEditar = vi.fn();
    const onIr = vi.fn();
    render(
      <CircuitoList
        circuitos={[circuito]}
        seleccionadoId="c1"
        onIr={onIr}
        onEditar={onEditar}
        onEliminar={vi.fn()}
      />
    );
    expect(screen.getByText("Planta → Puerto (cerrado)")).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveClass("bg-blue-50");

    fireEvent.click(screen.getByText("Ronda puerto"));
    expect(onIr).toHaveBeenCalledWith(circuito);
    fireEvent.click(screen.getByLabelText("Opciones de Ronda puerto"));
    fireEvent.click(screen.getByText("Editar"));
    expect(onEditar).toHaveBeenCalledWith(circuito);
  });

  it("shows the empty state inside the card", () => {
    render(
      <CircuitoList
        circuitos={[]}
        seleccionadoId={null}
        onIr={vi.fn()}
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
      />
    );
    expect(screen.getByText("Sin circuitos.")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
