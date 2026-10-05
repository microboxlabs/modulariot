import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PlaceList from "./place-list";
import type { Lugar } from "./places.types";

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
    modoCircuito: false,
    onIr: vi.fn(),
    onEditar: vi.fn(),
    onEliminar: vi.fn(),
    onAgregarAlCircuito: vi.fn(),
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
    expect(screen.getByText("local")).toBeInTheDocument();
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

  it("offers + only for server places while building a circuit", () => {
    const p = setup({ modoCircuito: true });
    expect(screen.queryByLabelText("Agregar Bodega al circuito")).toBeNull();
    fireEvent.click(screen.getByLabelText("Agregar Planta Norte al circuito"));
    expect(p.onAgregarAlCircuito).toHaveBeenCalledOnce();
  });

  it("shows the empty state with the search term", () => {
    setup({ lugares: [], busqueda: "xyz" });
    expect(screen.getByText("Sin lugares para «xyz».")).toBeInTheDocument();
  });
});
