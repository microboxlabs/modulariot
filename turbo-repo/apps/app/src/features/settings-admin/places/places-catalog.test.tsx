import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlacesCatalogLists, PlacesImportCard } from "./places-catalog";
import type { Lugar, Trayecto } from "./places.types";
import type { PlacesWorkspace } from "./use-places-workspace";

function importWs(
  over: Partial<{
    onArchivos: ReturnType<typeof vi.fn>;
    abrirImport: ReturnType<typeof vi.fn>;
    confirmarImport: ReturnType<typeof vi.fn>;
    lotes: {
      filename: string;
      formato: string;
      filas: {
        name: string;
        lat: number;
        lon: number;
        geometry_type: "circle" | "polygon";
      }[];
    }[];
  }> = {}
) {
  return {
    imp: {
      lotes: over.lotes ?? [],
      catDef: "",
      resultado: null,
    },
    setImp: vi.fn(),
    cats: [],
    fileRef: { current: null },
    onArchivos: over.onArchivos ?? vi.fn(),
    confirmarImport: over.confirmarImport ?? vi.fn(),
    abrirImport: over.abrirImport ?? vi.fn(),
    guardando: false,
  } as unknown as PlacesWorkspace;
}

describe("PlacesImportCard", () => {
  it("is a drop zone that opens the file selector for csv, kml and geojson", () => {
    render(<PlacesImportCard ws={importWs()} />);

    expect(
      screen.getByLabelText("Arrastra o elige un archivo")
    ).toBeInTheDocument();
    expect(screen.getByText("Seleccionar archivo")).toBeInTheDocument();
    const input = screen.getByLabelText("Seleccionar archivo");
    expect(input).toHaveAttribute(
      "accept",
      expect.stringContaining(".geojson")
    );
    expect(input).toHaveAttribute("accept", expect.stringContaining(".csv"));
    expect(input).toHaveAttribute("accept", expect.stringContaining(".kml"));
    expect(
      screen.getByRole("button", { name: "Cancelar" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("does not crash when import state has no lotes", () => {
    render(
      <PlacesImportCard
        ws={
          {
            ...importWs(),
            imp: { catDef: "", resultado: null },
          } as unknown as PlacesWorkspace
        }
      />
    );
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("cancels from the bottom button group and imports when a file is ready", () => {
    const abrirImport = vi.fn();
    const confirmarImport = vi.fn();
    const { rerender } = render(
      <PlacesImportCard ws={importWs({ abrirImport, confirmarImport })} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(abrirImport).toHaveBeenCalledOnce();

    rerender(
      <PlacesImportCard
        ws={importWs({
          abrirImport,
          confirmarImport,
          lotes: [
            {
              filename: "lugares-ejemplo.geojson",
              formato: "geojson",
              filas: [
                {
                  name: "Planta",
                  lat: -33.36,
                  lon: -70.73,
                  geometry_type: "circle",
                },
              ],
            },
          ],
        })}
      />
    );
    expect(screen.getByText("lugares-ejemplo.geojson")).toBeInTheDocument();
    expect(screen.getByText("Planta")).toBeInTheDocument();
    expect(screen.getByText("Círculo")).toBeInTheDocument();
    expect(screen.getByText("Importar otro archivo")).toBeInTheDocument();
    expect(screen.queryByText("Seleccionar archivo")).not.toBeInTheDocument();
    expect(screen.queryByText("Radio def.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Categoría")).toBeInTheDocument();
    const zona = document.querySelector("[data-places-import-drop]");
    expect(zona).toContainElement(screen.getByText("Planta"));
    expect(zona).toContainElement(screen.getByText("Importar otro archivo"));
    const importar = screen.getByRole("button", { name: /^Importar$/ });
    expect(zona).not.toContainElement(importar);
    expect(zona).not.toContainElement(
      screen.getByRole("button", { name: "Cancelar" })
    );
    expect(importar).toBeEnabled();
    fireEvent.click(importar);
    expect(confirmarImport).toHaveBeenCalledOnce();
  });

  it("adds another import group when a second file is dropped", () => {
    const onArchivos = vi.fn();
    render(
      <PlacesImportCard
        ws={importWs({
          onArchivos,
          lotes: [
            {
              filename: "lugares-ejemplo.csv",
              formato: "csv",
              filas: [
                {
                  name: "Planta",
                  lat: -33.36,
                  lon: -70.73,
                  geometry_type: "circle",
                },
              ],
            },
          ],
        })}
      />
    );
    const zona = screen
      .getByText("Planta")
      .closest("[data-places-import-drop]");
    expect(zona).toBeTruthy();
    const file = new File(["{}"], "otro.geojson", {
      type: "application/geo+json",
    });
    fireEvent.dragEnter(zona!);
    fireEvent.drop(zona!, { dataTransfer: { files: [file] } });
    expect(onArchivos).toHaveBeenCalledWith([file]);
  });

  it("loads dropped geojson files", () => {
    const onArchivos = vi.fn();
    render(<PlacesImportCard ws={importWs({ onArchivos })} />);
    const zona = screen.getByLabelText("Arrastra o elige un archivo");
    const file = new File(["{}"], "lugares-ejemplo.geojson", {
      type: "application/geo+json",
    });
    fireEvent.drop(zona, { dataTransfer: { files: [file] } });
    expect(onArchivos).toHaveBeenCalledWith([file]);
  });

  it("ignores dropped files that are not csv, kml or geojson", () => {
    const onArchivos = vi.fn();
    render(<PlacesImportCard ws={importWs({ onArchivos })} />);
    const zona = screen.getByLabelText("Arrastra o elige un archivo");
    fireEvent.drop(zona, {
      dataTransfer: {
        files: [new File(["x"], "foto.png", { type: "image/png" })],
      },
    });
    expect(onArchivos).not.toHaveBeenCalled();
  });
});

describe("PlacesCatalogLists", () => {
  it("puts lugares and trayectos in one card with expandable headers", () => {
    const lugar: Lugar = {
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
    };
    const trayecto: Trayecto = {
      trayecto_id: "t1",
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
    render(
      <PlacesCatalogLists
        ws={
          {
            busca: "",
            setBusca: vi.fn(),
            inp: "",
            lugares: [lugar],
            editandoLugarId: null,
            modo: "lista",
            irALugar: vi.fn(),
            editarLugar: vi.fn(),
            borrarLugar: vi.fn(),
            setHoveredPlaceId: vi.fn(),
            todosTrayectos: [trayecto],
            editandoTrayId: null,
            irATrayecto: vi.fn(),
            editarTrayecto: vi.fn(),
            borrarTrayecto: vi.fn(),
          } as unknown as PlacesWorkspace
        }
      />
    );

    expect(screen.getByText("Lugares")).toBeInTheDocument();
    expect(screen.getByText("Trayectos")).toBeInTheDocument();
    expect(screen.getByText("Lugares").closest(".rounded-lg.border")).toBe(
      screen.getByText("Trayectos").closest(".rounded-lg.border")
    );

    fireEvent.click(screen.getByLabelText("Ocultar Lugares"));
    expect(screen.queryByText("Planta Norte")).toBeNull();
    expect(screen.getByText("Acceso norte")).toBeInTheDocument();
  });

  it("shows only matching lugares or trayectos for the search text", () => {
    const lugar: Lugar = {
      place_id: "p1",
      name: "Geofence planta",
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
    };
    const trayecto: Trayecto = {
      trayecto_id: "t1",
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
    const ws = {
      busca: "geofence",
      setBusca: vi.fn(),
      inp: "",
      lugares: [lugar],
      editandoLugarId: null,
      modo: "lista",
      irALugar: vi.fn(),
      editarLugar: vi.fn(),
      borrarLugar: vi.fn(),
      setHoveredPlaceId: vi.fn(),
      todosTrayectos: [trayecto],
      editandoTrayId: null,
      irATrayecto: vi.fn(),
      editarTrayecto: vi.fn(),
      borrarTrayecto: vi.fn(),
    } as unknown as PlacesWorkspace;

    const { rerender } = render(<PlacesCatalogLists ws={ws} />);
    expect(screen.getByText("Geofence planta")).toBeInTheDocument();
    expect(screen.queryByText("Acceso norte")).toBeNull();
    expect(screen.queryByText("Trayectos")).toBeNull();

    rerender(
      <PlacesCatalogLists
        ws={{ ...ws, busca: "acceso", lugares: [lugar] } as PlacesWorkspace}
      />
    );
    expect(screen.getByText("Acceso norte")).toBeInTheDocument();
    expect(screen.queryByText("Geofence planta")).toBeNull();
    expect(screen.queryByText("Lugares")).toBeNull();
  });
});
