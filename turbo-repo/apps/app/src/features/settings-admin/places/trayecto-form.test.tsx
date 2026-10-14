import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TrayectoForm from "./trayecto-form";
import {
  TRAY_VACIO,
  type FormTrayecto,
  type Parada,
  type PasoTrayecto,
} from "./places.types";

function setup(
  recorrido?: Parada[],
  over: {
    eligiendoPuntoId?: string | null;
    resaltadoId?: string | null;
    paso?: PasoTrayecto;
    tray?: Partial<FormTrayecto>;
  } = {}
) {
  const { tray, ...resto } = over;
  const props = {
    tray: {
      ...TRAY_VACIO,
      recorrido: recorrido ?? TRAY_VACIO.recorrido,
      ...tray,
    },
    setTray: vi.fn(),
    guardando: false,
    msg: null,
    onSave: vi.fn(),
    onClose: vi.fn(),
    token: "tok",
    cerca: () => null,
    onRecorrido: vi.fn(),
    onElegirEnMapa: vi.fn(),
    onHoverPunto: vi.fn(),
    onPaso: vi.fn(),
    onTipo: vi.fn(),
    ...resto,
  };
  render(<TrayectoForm {...props} />);
  return props;
}

describe("TrayectoForm", () => {
  it("defines the route with address fields, not a method menu", () => {
    setup();
    expect(screen.getByLabelText("Desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Hasta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manual" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Por dirección" })).toBeNull();
    expect(screen.queryByText("Deshacer punto")).toBeNull();
  });

  it("shows the route card with one row per point", () => {
    const p = setup([
      { id: "a", texto: "Uno", punto: [1, 1] },
      { id: "m", texto: "Dos", punto: [2, 2] },
      { id: "b", texto: "Tres", punto: [3, 3] },
    ]);
    expect(screen.getByText("Recorrido")).toBeInTheDocument();
    // complete but not confirmed yet: asks to confirm on the map
    expect(
      screen.getByText("Confirma con «Listo» en el mapa")
    ).toBeInTheDocument();
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

  it("lets a route point be placed by clicking the map", () => {
    const p = setup();
    fireEvent.click(screen.getByLabelText("Marcar Desde en el mapa"));
    expect(p.onElegirEnMapa).toHaveBeenCalledWith("origen");
    fireEvent.click(screen.getByLabelText("Marcar Hasta en el mapa"));
    expect(p.onElegirEnMapa).toHaveBeenCalledWith("destino");
  });

  it("prompts to click the map while a point is waiting", () => {
    setup(undefined, { eligiendoPuntoId: "origen" });
    expect(
      screen.getByText("Clic en el mapa para ubicar Desde")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Cancelar marcar Desde en el mapa")
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("cannot remove below origin and destination", () => {
    setup([
      { id: "a", texto: "", punto: null },
      { id: "b", texto: "", punto: null },
    ]);
    expect(screen.getByLabelText("Quitar Desde")).toBeDisabled();
  });

  describe("tabs", () => {
    const tres: Parada[] = [
      { id: "a", texto: "Uno", punto: [1, 1] },
      { id: "m", texto: "Dos", punto: [2, 2] },
      { id: "b", texto: "Tres", punto: [3, 3] },
    ];

    it("starts on the route tab with cancel and save", () => {
      const p = setup(tres);
      expect(
        screen.getByRole("heading", { name: "Crear trayecto" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Trayecto" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.queryByPlaceholderText("Ej: Acceso norte")).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Información del trayecto" })
      );
      expect(p.onPaso).toHaveBeenCalledWith("datos");
      fireEvent.click(screen.getByRole("button", { name: "Guardar trayecto" }));
      expect(p.onSave).toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(p.onClose).toHaveBeenCalled();
    });

    it("shows the info fields on the second tab", () => {
      const p = setup(tres, {
        paso: "datos",
        tray: { name: "Acceso norte", id: "t1", kind: "vial" },
      });
      expect(
        screen.getByRole("heading", { name: "Editar trayecto" })
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Ej: Acceso norte")).toHaveValue(
        "Acceso norte"
      );
      expect(screen.getByText("Uno → Tres")).toBeInTheDocument();
      expect(screen.getByText(/1 parada/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Desde")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Interno (faena)" }));
      expect(p.onTipo).toHaveBeenCalledWith("interno");
      // corridor width uses the same size control as the geofence radius
      fireEvent.change(screen.getByLabelText("Ancho del corredor"), {
        target: { value: "45" },
      });
      const cambio = p.setTray.mock.calls.at(-1)?.[0];
      expect(cambio(p.tray).width_m).toBe(45);
      fireEvent.click(screen.getByRole("button", { name: "Trayecto" }));
      expect(p.onPaso).toHaveBeenCalledWith("recorrido");
    });

    it("highlights the hovered point", () => {
      const p = setup(tres, { resaltadoId: "m" });
      const fila = screen.getByLabelText("Parada 1").closest(".px-1\\.5");
      expect(fila).toHaveClass("bg-blue-50");
      fireEvent.mouseEnter(screen.getByLabelText("Hasta"));
      expect(p.onHoverPunto).toHaveBeenCalledWith("b");
    });

    it("marks and focuses a missing name when saving", () => {
      const p = setup(tres, { paso: "datos" });
      const nombre = screen.getByPlaceholderText("Ej: Acceso norte");
      expect(nombre).toHaveAttribute("aria-invalid", "false");
      fireEvent.click(screen.getByRole("button", { name: "Guardar trayecto" }));
      expect(p.onSave).toHaveBeenCalled();
      expect(nombre).toHaveAttribute("aria-invalid", "true");
      expect(nombre).toHaveFocus();
    });
  });
});
