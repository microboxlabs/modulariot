import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TrayectoForm from "./trayecto-form";

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
import {
  TRAY_VACIO,
  type FormTrayecto,
  type Parada,
  type PasoTrayecto,
} from "../places.types";

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
      screen.getByText("Haz clic en «Listo» para ver cómo quedará el trayecto")
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

  it("starts placing a newly added point on the map", () => {
    const p = setup();
    fireEvent.click(screen.getByText("Agregar punto"));
    const [cambio] = p.onRecorrido.mock.calls.at(-1)!;
    const nuevo = cambio(p.tray).recorrido[1]!;
    // the new stop, between origin and destination, waits for a map click
    expect(nuevo.punto).toBeNull();
    expect(p.onElegirEnMapa).toHaveBeenCalledWith(nuevo.id);
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
      // origin and destination, each on its own row with its badge
      expect(screen.getByText("Uno")).toHaveAttribute("title", "Uno");
      expect(screen.getByText("Tres")).toHaveAttribute("title", "Tres");
      expect(screen.getByText("Desde")).toBeInTheDocument();
      // between A and B: how many intermediate points
      expect(screen.getByText("1 punto intermedio")).toBeInTheDocument();
      expect(screen.queryByLabelText("Desde")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Interno (faena)" }));
      expect(p.onTipo).toHaveBeenCalledWith("interno");
      // corridor width uses the same size control as the geofence radius
      fireEvent.change(screen.getByLabelText("Ancho del corredor"), {
        target: { value: "45" },
      });
      const cambio = p.setTray.mock.calls.at(-1)?.[0];
      expect(cambio(p.tray).width_m).toBe(45);
      // the categories selector, in the info tab
      expect(
        screen.getByRole("group", { name: "Categorías" })
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Trayecto" }));
      expect(p.onPaso).toHaveBeenCalledWith("recorrido");
    });

    it("highlights the hovered point", () => {
      const p = setup(tres, { resaltadoId: "m" });
      const fila = screen
        .getByLabelText("Parada 1")
        .closest("[data-punto-fila]");
      expect(fila).toHaveClass("bg-blue-50");
      // its category strip lights up with it
      fireEvent.click(
        screen.getByRole("button", { name: "Categoría de Parada 1" })
      );
      const pie = fila!.querySelector(".border-t");
      expect(pie).toHaveClass("bg-blue-50");
      expect(pie).not.toHaveClass("bg-gray-50");
      fireEvent.mouseEnter(screen.getByLabelText("Hasta"));
      expect(p.onHoverPunto).toHaveBeenCalledWith("b");
    });

    it("opens the point category as a dropdown at the bottom of the row", () => {
      setup(tres);
      expect(screen.queryByText("Categoría")).toBeNull();
      const fila = screen
        .getByLabelText("Parada 1")
        .closest("[data-punto-fila]")!;
      const boton = screen.getByRole("button", {
        name: "Categoría de Parada 1",
      });
      expect(boton).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(boton);
      expect(boton).toHaveAttribute("aria-expanded", "true");
      // just the dropdown, no "Categoría" caption beside it
      const pie = fila.querySelector(".border-t");
      expect(pie).not.toBeNull();
      expect(pie).toHaveClass("bg-gray-50");
      expect(pie).not.toHaveTextContent(/^Categoría/);
      expect(screen.queryByText("Categoría")).toBeNull();
      // only points between A and B have one
      expect(
        screen.queryByRole("button", { name: "Categoría de Desde" })
      ).toBeNull();
    });

    it("toggles a point between stop and deviation with one button", () => {
      const p = setup(tres);
      // origin and destination have no toggle
      expect(screen.queryByLabelText(/^Desde:/)).toBeNull();
      expect(screen.queryByLabelText(/^Hasta:/)).toBeNull();
      // on by default: a stop, numbered 1
      const boton = screen.getByRole("button", { name: "Parada 1: parada" });
      expect(boton).toHaveAttribute("aria-pressed", "true");
      expect(boton).toHaveTextContent("1");
      fireEvent.click(boton);
      const cambio = p.setTray.mock.calls.at(-1)?.[0];
      expect(cambio(p.tray).recorrido[1].tipo).toBe("desvio");
    });

    it("shows a deviation as a circle, and numbers only the stops", () => {
      setup([
        { id: "a", texto: "Uno", punto: [1, 1] },
        { id: "d", texto: "Dos", punto: [2, 2], tipo: "desvio" },
        { id: "m", texto: "Tres", punto: [3, 3] },
        { id: "b", texto: "Cuatro", punto: [4, 4] },
      ]);
      const desvio = screen.getByRole("button", { name: "Desvío 1: desvío" });
      expect(desvio).toHaveAttribute("aria-pressed", "false");
      expect(desvio).toHaveTextContent("");
      // the stop after the deviation is stop 1, not 2
      expect(
        screen.getByRole("button", { name: "Parada 1: parada" })
      ).toBeInTheDocument();
    });

    it("shows how long the route is, with stops and deviations", () => {
      render(
        <TrayectoForm
          tray={{
            ...TRAY_VACIO,
            recorrido: [
              { id: "a", texto: "Uno", punto: [1, 1] },
              { id: "d", texto: "Dos", punto: [2, 2], tipo: "desvio" },
              { id: "b", texto: "Tres", punto: [3, 3] },
            ],
          }}
          setTray={vi.fn()}
          guardando={false}
          msg={null}
          token="tok"
          cerca={() => null}
          onRecorrido={vi.fn()}
          onPaso={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
          paso="datos"
          distanciaM={12_400}
        />
      );
      expect(screen.getByText("12,4 km")).toBeInTheDocument();
      // a deviation counts as an intermediate point too
      expect(screen.getByText("1 punto intermedio")).toBeInTheDocument();
    });

    it("counts the intermediate points between A and B", () => {
      const medio = Array.from({ length: 6 }, (_, i) => ({
        id: `m${i}`,
        texto: `Punto ${i}`,
        punto: [i + 2, i + 2] as [number, number],
      }));
      setup(
        [
          { id: "a", texto: "Inicio", punto: [1, 1] },
          ...medio,
          { id: "b", texto: "Fin", punto: [9, 9] },
        ],
        { paso: "datos" }
      );
      expect(screen.getByText("6 puntos intermedios")).toBeInTheDocument();
      expect(screen.queryByText("Punto 0")).toBeNull();
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
