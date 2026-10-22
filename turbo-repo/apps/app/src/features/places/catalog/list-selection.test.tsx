import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlaceList from "./place-list";
import {
  SelectionBar,
  resumenSeleccion,
  useSeleccionLista,
} from "./list-selection";
import type { Lugar, Trayecto } from "../places.types";

const lugar = (place_id: string, name: string): Lugar => ({
  place_id,
  name,
  address: null,
  category: null,
  category_id: null,
  geometry_type: "circle",
  color: null,
  center: [-33, -70],
  polygon: null,
  radius_m: 250,
  metadata: null,
  external_id: null,
  active_from: null,
  active_until: null,
});

const trayecto: Trayecto = {
  trayecto_id: "t1",
  name: "Ruta 5",
  kind: "vial",
  width_m: 30,
  points: [],
  waypoints: null,
  parent_name: null,
  ajustado: false,
  external_id: null,
};

const lugares = [lugar("p1", "Planta Norte"), lugar("p2", "Bodega")];

describe("list selection", () => {
  it("picks rows, selects everything visible and clears", () => {
    const { result } = renderHook(() => useSeleccionLista(lugares, [trayecto]));
    expect(result.current.total).toBe(0);
    expect(result.current.marcasLugares.siempre).toBe(false);

    act(() => result.current.marcasLugares.onMarcar("p2", true));
    expect(result.current.lugaresSel.map((l) => l.name)).toEqual(["Bodega"]);
    // once something is picked, every row shows its checkbox
    expect(result.current.marcasTrayectos.siempre).toBe(true);

    act(() => result.current.marcarVisibles(lugares, [trayecto]));
    expect(result.current.total).toBe(3);
    // everything already picked: the same toggle clears it
    act(() => result.current.marcarVisibles(lugares, [trayecto]));
    expect(result.current.total).toBe(0);
  });

  it("forgets what no longer exists", () => {
    const { result, rerender } = renderHook(
      ({ ls }) => useSeleccionLista(ls, []),
      { initialProps: { ls: lugares } }
    );
    act(() => result.current.marcasLugares.onMarcar("p1", true));
    rerender({ ls: [lugares[1]!] });
    expect(result.current.total).toBe(0);
  });

  it("gives each row a checkbox that marks it", () => {
    const onMarcar = vi.fn();
    render(
      <PlaceList
        lugares={lugares}
        busqueda=""
        seleccionadoId={null}
        onIr={vi.fn()}
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
        marcas={{
          marcados: new Set(["p1"]),
          onMarcar,
          onMarcarVarios: vi.fn(),
          siempre: true,
        }}
      />
    );
    const planta = screen.getByRole("checkbox", {
      name: "Seleccionar Planta Norte",
    });
    expect(planta).toBeChecked();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Seleccionar Bodega" })
    );
    expect(onMarcar).toHaveBeenCalledWith("p2", true);
  });

  it("selects or clears a whole section from its header", () => {
    const onMarcarVarios = vi.fn();
    const props = {
      lugares,
      busqueda: "",
      seleccionadoId: null,
      onIr: vi.fn(),
      onEditar: vi.fn(),
      onEliminar: vi.fn(),
    };
    const { rerender } = render(
      <PlaceList
        {...props}
        marcas={{
          marcados: new Set(["p1"]),
          onMarcar: vi.fn(),
          onMarcarVarios,
          siempre: true,
        }}
      />
    );
    const cabecera = () =>
      screen.getByRole("checkbox", { name: "Seleccionar todos: Lugares" });
    // only some picked: the header picks the rest
    expect(cabecera()).not.toBeChecked();
    fireEvent.click(cabecera());
    expect(onMarcarVarios).toHaveBeenLastCalledWith(["p1", "p2"], true);
    // all picked: the header clears them
    rerender(
      <PlaceList
        {...props}
        marcas={{
          marcados: new Set(["p1", "p2"]),
          onMarcar: vi.fn(),
          onMarcarVarios,
          siempre: true,
        }}
      />
    );
    expect(cabecera()).toBeChecked();
    fireEvent.click(cabecera());
    expect(onMarcarVarios).toHaveBeenLastCalledWith(["p1", "p2"], false);
  });

  it("picks and drops several at once in the hook", () => {
    const { result } = renderHook(() => useSeleccionLista(lugares, [trayecto]));
    act(() => result.current.marcasLugares.onMarcarVarios(["p1", "p2"], true));
    expect(result.current.total).toBe(2);
    act(() => result.current.marcasLugares.onMarcarVarios(["p1"], false));
    expect(result.current.lugaresSel.map((l) => l.place_id)).toEqual(["p2"]);
  });

  it("offers select all, cancel and delete while something is picked", () => {
    const onTodos = vi.fn();
    const onCancelar = vi.fn();
    const onEliminar = vi.fn();
    render(
      <SelectionBar
        total={2}
        todosVisibles={false}
        onTodos={onTodos}
        onCancelar={onCancelar}
        onEliminar={onEliminar}
      />
    );
    expect(screen.getByText("2 seleccionados")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Seleccionar todo lo visible" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onTodos).toHaveBeenCalled();
    expect(onCancelar).toHaveBeenCalled();
    expect(onEliminar).toHaveBeenCalled();
  });

  it("sums up a batch for the confirmation", () => {
    expect(resumenSeleccion(3, 2)).toBe("3 lugares y 2 trayectos");
    expect(resumenSeleccion(1, 0)).toBe("1 lugar");
    expect(resumenSeleccion(0, 1)).toBe("1 trayecto");
  });
});
