import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PlaceList from "./place-list";
import { PARENT_KEY, type Lugar } from "../places.types";

const lugar = (over: Partial<Lugar>): Lugar => ({
  place_id: "p1",
  name: "Planta Norte",
  address: "Ruta 5",
  category: "Planta",
  category_id: 1,
  geometry_type: "circle",
  color: null,
  center: [-33, -70],
  polygon: null,
  radius_m: 250,
  metadata: null,
  external_id: null,
  active_from: null,
  active_until: null,
  ...over,
});

function setup(over: Partial<Parameters<typeof PlaceList>[0]> = {}) {
  const props = {
    lugares: [lugar({}), lugar({ place_id: "local-x", name: "Bodega" })],
    busqueda: "",
    seleccionadoId: null,
    onIr: vi.fn(),
    onEditar: vi.fn(),
    onEliminar: vi.fn(),
    ...over,
  };
  render(<PlaceList {...props} />);
  return props;
}

describe("PlaceList", () => {
  it("renders one card with a count header and a row per place", () => {
    setup();
    expect(screen.getByText("Lugares")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("local")).toBeNull();
  });

  it("goes to the place when its name is clicked", () => {
    const p = setup();
    fireEvent.click(screen.getByText("Planta Norte"));
    expect(p.onIr).toHaveBeenCalledWith(
      expect.objectContaining({ place_id: "p1" })
    );
  });

  it("edits and deletes from the three-dots menu", () => {
    const p = setup();
    fireEvent.click(screen.getByLabelText("Opciones de Planta Norte"));
    fireEvent.click(screen.getByText("Editar"));
    expect(p.onEditar).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByLabelText("Opciones de Planta Norte"));
    fireEvent.click(screen.getByText("Eliminar"));
    expect(p.onEliminar).toHaveBeenCalledOnce();
  });

  it("has no edit/delete menu on StreamHub geofences (read-only)", () => {
    setup({
      lugares: [
        lugar({ place_id: "streamhub-7", name: "Demo depot" }),
        lugar({ place_id: "local-x", name: "Bodega" }),
      ],
    });
    expect(screen.getByText("Demo depot")).toBeInTheDocument();
    expect(screen.queryByLabelText("Opciones de Demo depot")).toBeNull();
    // a test place created here keeps its menu
    expect(screen.getByLabelText("Opciones de Bodega")).toBeInTheDocument();
  });

  it("shows the empty state with the search term", () => {
    setup({ lugares: [], busqueda: "xyz" });
    expect(screen.getByText("Sin lugares para «xyz».")).toBeInTheDocument();
  });

  it("nests inner geofences under their parent", () => {
    setup({
      lugares: [
        lugar({ place_id: "park", name: "Estacionamiento" }),
        lugar({
          place_id: "lot",
          name: "Lote VIP",
          metadata: { [PARENT_KEY]: "park" },
        }),
      ],
    });
    expect(screen.queryByText("interior · Planta")).toBeNull();
    expect(screen.getByText(/1 interior/)).toBeInTheDocument();
    const vip = screen.getByText("Lote VIP");
    expect(vip.className).toContain("text-xs");
    expect(vip.closest("ul")?.className).not.toMatch(/border-l/);
    expect(vip.closest("ul")?.className).toMatch(/bg-gray-100/);
  });

  it("shows inner rows as name and options only", () => {
    setup({
      lugares: [
        lugar({ place_id: "park", name: "Estacionamiento" }),
        lugar({
          place_id: "lot",
          name: "Lote VIP",
          metadata: { [PARENT_KEY]: "park" },
        }),
      ],
    });
    expect(screen.getByText("Lote VIP")).toBeInTheDocument();
    expect(screen.getByLabelText("Opciones de Lote VIP")).toBeInTheDocument();
  });

  it("reports hover on compact inner rows", () => {
    const onHover = vi.fn();
    setup({
      onHover,
      lugares: [
        lugar({ place_id: "park", name: "Estacionamiento" }),
        lugar({
          place_id: "lot",
          name: "Lote VIP",
          metadata: { [PARENT_KEY]: "park" },
        }),
      ],
    });
    const fila = screen.getByText("Lote VIP").closest("li");
    expect(fila).toBeTruthy();
    fireEvent.mouseEnter(fila!);
    expect(onHover).toHaveBeenCalledWith("lot");
    fireEvent.mouseLeave(fila!);
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it("reports hover on parent rows too", () => {
    const onHover = vi.fn();
    setup({
      onHover,
      lugares: [
        lugar({ place_id: "park", name: "Estacionamiento" }),
        lugar({
          place_id: "lot",
          name: "Lote VIP",
          metadata: { [PARENT_KEY]: "park" },
        }),
      ],
    });
    const nombre = screen.getByText("Estacionamiento");
    fireEvent.mouseEnter(nombre);
    expect(onHover).toHaveBeenCalledWith("park");
    fireEvent.mouseLeave(nombre);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("collapses the Lugares section from the expandable header", () => {
    setup();
    expect(screen.getByText("Planta Norte")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Ocultar Lugares"));
    expect(screen.queryByText("Planta Norte")).toBeNull();
    fireEvent.click(screen.getByLabelText("Mostrar Lugares"));
    expect(screen.getByText("Planta Norte")).toBeInTheDocument();
  });

  it("collapses the parent together with its inner geofences", () => {
    setup({
      lugares: [
        lugar({ place_id: "park", name: "Estacionamiento" }),
        lugar({
          place_id: "lot",
          name: "Lote VIP",
          metadata: { [PARENT_KEY]: "park" },
        }),
      ],
    });
    expect(screen.getByText("Lote VIP")).toBeInTheDocument();
    fireEvent.click(
      screen.getByLabelText("Ocultar interiores de Estacionamiento")
    );
    expect(screen.queryByText("Lote VIP")).toBeNull();
    expect(screen.getByText("Estacionamiento")).toBeInTheDocument();
    fireEvent.click(
      screen.getByLabelText("Mostrar interiores de Estacionamiento")
    );
    expect(screen.getByText("Lote VIP")).toBeInTheDocument();
  });
});
