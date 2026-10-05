import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TrayectoForm from "./trayecto-form";
import { TRAY_VACIO, type MetodoTrayecto, type Parada } from "./places.types";

function setup(metodo: MetodoTrayecto, recorrido?: Parada[]) {
  const props = {
    tray: {
      ...TRAY_VACIO,
      metodo,
      recorrido: recorrido ?? TRAY_VACIO.recorrido,
    },
    setTray: vi.fn(),
    guardando: false,
    msg: null,
    onUndoPoint: vi.fn(),
    onAjustar: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    token: "tok",
    cerca: () => null,
    onMetodo: vi.fn(),
    onRecorrido: vi.fn(),
  };
  render(<TrayectoForm {...props} />);
  return props;
}

describe("TrayectoForm", () => {
  it("manual mode shows the point tools, not the address fields", () => {
    setup("manual");
    expect(screen.getByText("Deshacer punto")).toBeInTheDocument();
    expect(screen.queryByLabelText("Desde")).toBeNull();
  });

  it("address mode shows Desde/Hasta instead of the point tools", () => {
    setup("direccion");
    expect(screen.getByLabelText("Desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Hasta")).toBeInTheDocument();
    expect(screen.queryByText("Deshacer punto")).toBeNull();
  });

  it("switches method from the tab bar", () => {
    const p = setup("manual");
    fireEvent.click(screen.getByRole("button", { name: "Por dirección" }));
    expect(p.onMetodo).toHaveBeenCalledWith("direccion");
  });

  it("address mode shows the route card with one row per point", () => {
    const p = setup("direccion", [
      { id: "a", texto: "Uno", punto: [1, 1] },
      { id: "m", texto: "Dos", punto: [2, 2] },
      { id: "b", texto: "Tres", punto: [3, 3] },
    ]);
    expect(screen.getByText("Recorrido")).toBeInTheDocument();
    expect(screen.getByText("3 puntos")).toBeInTheDocument();
    expect(screen.getByLabelText("Desde")).toHaveValue("Uno");
    expect(screen.getByLabelText("Parada 1")).toHaveValue("Dos");
    expect(screen.getByLabelText("Hasta")).toHaveValue("Tres");
    expect(screen.getAllByTitle("Arrastra para cambiar el orden")).toHaveLength(
      3
    );

    fireEvent.click(screen.getByText("Agregar punto"));
    fireEvent.click(screen.getByLabelText("Quitar Parada 1"));
    // the sortable list may report its (unchanged) order: those calls are
    // no-ops; keep only the transitions that change the route
    const efectivos = p.onRecorrido.mock.calls
      .map(([cambio]) => cambio(p.tray))
      .filter((t) => t !== p.tray);
    expect(efectivos.map((t) => t.recorrido.length)).toEqual([4, 2]);
  });

  it("cannot remove below origin and destination", () => {
    setup("direccion", [
      { id: "a", texto: "", punto: null },
      { id: "b", texto: "", punto: null },
    ]);
    expect(screen.getByLabelText("Quitar Desde")).toBeDisabled();
  });
});
