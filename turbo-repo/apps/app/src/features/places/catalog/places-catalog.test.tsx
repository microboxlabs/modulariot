import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import es from "@/lang/es.json";
import { PlacesCatalogLists, PlacesImportCard } from "./places-catalog";
import type { Lugar, Trayecto } from "../places.types";
import type { PlacesWorkspace } from "../hooks/use-places-workspace";
import type {
  ConflictoImport,
  DecisionImport,
} from "../import-export/import-conflicts";

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
        geometry_type: "circle" | "polygon" | "line";
      }[];
    }[];
    conflictosImp: Map<string, ConflictoImport[]>;
    decisiones: Record<string, DecisionImport>;
    seleccion: string[];
  }> = {}
) {
  // cada fila con un uid estable, como al cargar el archivo
  const lotes = (over.lotes ?? []).map((l) => ({
    ...l,
    filas: l.filas.map((f, i) => ({ ...f, uid: `${l.filename}#${i}` })),
  }));
  return {
    imp: {
      lotes,
      catDef: "",
      resultado: null,
      decisiones: over.decisiones ?? {},
      seleccion: over.seleccion ?? [],
    },
    filasImp: lotes.flatMap((l) => l.filas),
    conflictosImp: over.conflictosImp ?? new Map(),
    hoverImportUid: null,
    decidirImport: vi.fn(),
    alternarSeleccionImport: vi.fn(),
    marcarFilasImport: vi.fn(),
    seleccionarTodoImport: vi.fn(),
    quitarFilasImport: vi.fn(),
    hoverFilaImport: vi.fn(),
    hoverConflictoImport: vi.fn(),
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
    // shape and position come from the file: not shown in the list
    expect(screen.queryByText(/Círculo/)).not.toBeInTheDocument();
    expect(screen.getByText("1 sin conflicto")).toBeInTheDocument();
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

  it("shows a total conflict in red and lets you pick what to keep", () => {
    const lote = {
      filename: "a.geojson",
      formato: "geojson",
      filas: [
        { name: "Planta", lat: 1, lon: 1, geometry_type: "circle" as const },
      ],
    };
    const conflictosImp = new Map<string, ConflictoImport[]>([
      [
        "a.geojson#0",
        [{ tipo: "total", con: { tipo: "fila", uid: "x", name: "Bodega" } }],
      ],
    ]);
    const ws = importWs({ lotes: [lote], conflictosImp });
    render(<PlacesImportCard ws={ws} />);

    // red dot and a second line saying what it equals
    expect(
      screen.getByLabelText("Conflicto total: misma geocerca")
    ).toHaveClass("bg-red-500");
    expect(screen.getByText("Igual a")).toBeInTheDocument();
    const chip = screen.getByText("Bodega");
    // hovering the conflict shows both on the map
    fireEvent.mouseEnter(chip);
    expect(ws.hoverConflictoImport).toHaveBeenCalledWith(
      "a.geojson#0",
      expect.objectContaining({ tipo: "total" })
    );
    fireEvent.mouseLeave(chip);
    expect(ws.hoverConflictoImport).toHaveBeenLastCalledWith(
      "a.geojson#0",
      null
    );

    // Flowbite button group: Existente / Nuevo (a total has no "Ambos")
    const decision = screen.getByRole("group", {
      name: "Qué conservar para Planta",
    });
    expect(
      within(decision).getByRole("button", { name: "Existente" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(decision).not.toHaveTextContent("Ambos");
    fireEvent.click(within(decision).getByRole("button", { name: "Nuevo" }));
    expect(ws.decidirImport).toHaveBeenCalledWith("a.geojson#0", "nuevo");

    fireEvent.click(screen.getByLabelText("Seleccionar Planta"));
    expect(ws.alternarSeleccionImport).toHaveBeenCalledWith("a.geojson#0");
    fireEvent.mouseEnter(screen.getByText("Planta"));
    expect(ws.hoverFilaImport).toHaveBeenCalledWith("a.geojson#0");
    // no delete button per row: rows are removed from the header
    expect(screen.queryByLabelText("Quitar Planta")).toBeNull();
    expect(screen.getByText("1 total")).toBeInTheDocument();
  });

  it("tells routes apart from geofences in an imported file", () => {
    const lote = {
      filename: "mixto.geojson",
      formato: "geojson",
      filas: [
        { name: "Planta", lat: 1, lon: 1, geometry_type: "circle" as const },
        { name: "Ruta", lat: 2, lon: 2, geometry_type: "line" as const },
      ],
    };
    render(<PlacesImportCard ws={importWs({ lotes: [lote] })} />);
    expect(screen.getByText("1 geocerca · 1 trayecto")).toBeInTheDocument();
    expect(screen.getByLabelText("Trayecto")).toBeInTheDocument();
    expect(screen.getByLabelText("Geocerca")).toBeInTheDocument();
  });

  it("selects a whole file and removes the selection from the header", () => {
    const lote = {
      filename: "a.geojson",
      formato: "geojson",
      filas: [
        { name: "Uno", lat: 1, lon: 1, geometry_type: "circle" as const },
        { name: "Dos", lat: 2, lon: 2, geometry_type: "circle" as const },
      ],
    };
    const ws = importWs({ lotes: [lote], seleccion: ["a.geojson#1"] });
    render(<PlacesImportCard ws={ws} />);

    // one of two marked: the file checkbox is "some", clicking marks all
    const archivo = screen.getByLabelText("Seleccionar todo a.geojson");
    expect(archivo).not.toBeChecked();
    expect((archivo as HTMLInputElement).indeterminate).toBe(true);
    fireEvent.click(archivo);
    expect(ws.marcarFilasImport).toHaveBeenCalledWith(
      ["a.geojson#0", "a.geojson#1"],
      true
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar seleccionadas (1)" })
    );
    expect(ws.quitarFilasImport).toHaveBeenCalledWith(["a.geojson#1"]);
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
            versionDe: (tipo: string) => (tipo === "lugar" ? "1.2.0" : "1.0.0"),
          } as unknown as PlacesWorkspace
        }
      />
    );

    expect(screen.getByText("Lugares")).toBeInTheDocument();
    expect(screen.getByText("Trayectos")).toBeInTheDocument();
    // each geofence and trayecto shows its version
    expect(screen.getByText("v1.2.0")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
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
      versionDe: () => "1.0.0",
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

  it("filters the geofences by a category picked in the bar and hides routes meanwhile", async () => {
    const base: Lugar = {
      place_id: "p1",
      name: "Zona el Manzano",
      address: null,
      category: "Zona de riesgo",
      category_id: null,
      geometry_type: "polygon",
      color: null,
      center: [-33, -70],
      polygon: [
        [-33, -70],
        [-32, -70],
        [-32, -69],
      ],
      radius_m: null,
      metadata: null,
      external_id: null,
      active_from: null,
      active_until: null,
    };
    const otro: Lugar = {
      ...base,
      place_id: "p2",
      name: "Copec POZ",
      category: "General",
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
      busca: "",
      setBusca: vi.fn(),
      lugares: [base, otro],
      todosLugares: [base, otro],
      editandoLugarId: null,
      modo: "lista",
      irALugar: vi.fn(),
      setHoveredPlaceId: vi.fn(),
      todosTrayectos: [trayecto],
      versionDe: () => null,
      editandoTrayId: null,
      irATrayecto: vi.fn(),
      puedeEditar: false,
    } as unknown as PlacesWorkspace;

    render(<PlacesCatalogLists ws={ws} dict={es} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Acceso norte")).toBeInTheDocument();

    // the bar says where the text is: a category, not a name
    fireEvent.change(
      screen.getByPlaceholderText("Buscar por nombre o categoría…"),
      { target: { value: "riesgo" } }
    );
    const categoria = await screen.findByRole("button", {
      name: /Categoría/,
    });
    expect(categoria).toHaveTextContent("(1)");
    expect(screen.queryByRole("button", { name: /Nombre/ })).toBeNull();

    fireEvent.click(categoria);
    expect(screen.getByText("Categoría: riesgo")).toBeInTheDocument();
    expect(screen.getByText("Zona el Manzano")).toBeInTheDocument();
    expect(screen.queryByText("Copec POZ")).toBeNull();
    expect(screen.queryByText("Acceso norte")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar Categoría: riesgo" })
    );
    expect(screen.getByText("Copec POZ")).toBeInTheDocument();
    expect(screen.getByText("Acceso norte")).toBeInTheDocument();
  });

  it("filters by geofence name, the trip's read-only ones included", async () => {
    const base: Lugar = {
      place_id: "p1",
      name: "Planta Norte",
      address: null,
      category: "Planta",
      category_id: null,
      geometry_type: "circle",
      color: null,
      center: [-33, -70],
      polygon: null,
      radius_m: 100,
      metadata: null,
      external_id: null,
      active_from: null,
      active_until: null,
    };
    const ws = {
      busca: "",
      setBusca: vi.fn(),
      lugares: [],
      todosLugares: [
        base,
        { ...base, place_id: "p2", name: "Puerto Sur", category: "Puerto" },
      ],
      todosTrayectos: [],
      editandoLugarId: null,
      editandoTrayId: null,
      modo: "ver",
      irALugar: vi.fn(),
      setHoveredPlaceId: vi.fn(),
      versionDe: () => null,
      puedeEditar: false,
    } as unknown as PlacesWorkspace;
    const externas = {
      titulo: "Geocercas del viaje",
      items: [
        {
          id: "o",
          nombre: "Planta Quilicura",
          detalle: "Origen del viaje",
          ancla: [-33.36, -70.73] as [number, number],
        },
      ],
    };
    render(<PlacesCatalogLists ws={ws} externas={externas} dict={es} />);

    fireEvent.change(
      screen.getByPlaceholderText("Buscar por nombre o categoría…"),
      { target: { value: "planta" } }
    );
    // both fields match: one category, two names (one is the trip's)
    const nombre = await screen.findByRole("button", { name: /Nombre/ });
    expect(nombre).toHaveTextContent("(2)");
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "(1)"
    );

    fireEvent.click(nombre);
    expect(screen.getByText("Nombre: planta")).toBeInTheDocument();
    expect(screen.getByText("Planta Norte")).toBeInTheDocument();
    expect(screen.getByText("Planta Quilicura")).toBeInTheDocument();
    expect(screen.queryByText("Puerto Sur")).toBeNull();
  });

  it("says nothing is left when the filters match no geofence", async () => {
    const ws = {
      busca: "",
      setBusca: vi.fn(),
      lugares: [],
      todosLugares: [],
      todosTrayectos: [],
      editandoLugarId: null,
      editandoTrayId: null,
      modo: "lista",
      versionDe: () => null,
      puedeEditar: false,
    } as unknown as PlacesWorkspace;
    render(<PlacesCatalogLists ws={ws} dict={es} />);
    fireEvent.change(
      screen.getByPlaceholderText("Buscar por nombre o categoría…"),
      { target: { value: "xyz" } }
    );
    expect(
      await screen.findByText("Ninguna geocerca coincide")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Categoría|Nombre/ })
    ).toBeNull();
  });

  it("is read-only without the Editor de lugares permission", () => {
    const lugar: Lugar = {
      place_id: "p1",
      name: "Planta Norte",
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
    };
    const ws = (puedeEditar: boolean) =>
      ({
        busca: "",
        setBusca: vi.fn(),
        lugares: [lugar],
        todosLugares: [lugar],
        editandoLugarId: null,
        modo: "ver",
        irALugar: vi.fn(),
        editarLugar: vi.fn(),
        borrarLugar: vi.fn(),
        setHoveredPlaceId: vi.fn(),
        todosTrayectos: [],
        versionDe: () => "1.0.0",
        editandoTrayId: null,
        irATrayecto: vi.fn(),
        editarTrayecto: vi.fn(),
        borrarTrayecto: vi.fn(),
        abrirImport: vi.fn(),
        puedeEditar,
      }) as unknown as PlacesWorkspace;

    const { rerender } = render(<PlacesCatalogLists ws={ws(true)} />);
    // with the permission: import, row menu and checkboxes
    expect(
      screen.getByRole("button", { name: "Importar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Opciones de Planta Norte" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Planta Norte" })
    ).toBeInTheDocument();

    rerender(<PlacesCatalogLists ws={ws(false)} dict={es} />);
    // without it: list, search and download only
    expect(screen.queryByRole("button", { name: "Importar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Agregar" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Opciones de Planta Norte" })
    ).toBeNull();
    expect(
      screen.queryByRole("checkbox", { name: "Seleccionar Planta Norte" })
    ).toBeNull();
    expect(
      screen.getByPlaceholderText("Buscar por nombre o categoría…")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Exportar" })
    ).toBeInTheDocument();
    expect(screen.getByText("Planta Norte")).toBeInTheDocument();
  });

  it("adds a geofence or a route from the Agregar dropdown", () => {
    const nuevoLugar = vi.fn();
    const nuevoTrayecto = vi.fn();
    render(
      <PlacesCatalogLists
        ws={
          {
            busca: "",
            setBusca: vi.fn(),
            lugares: [],
            todosLugares: [],
            todosTrayectos: [],
            modo: "ver",
            abrirImport: vi.fn(),
            nuevoLugar,
            nuevoTrayecto,
            puedeEditar: true,
            versionDe: () => "1.0.0",
          } as unknown as PlacesWorkspace
        }
      />
    );
    const agregar = screen.getByRole("button", { name: "Agregar" });
    // Flowbite: the item's button (inside the menuitem) takes the click
    fireEvent.click(agregar);
    fireEvent.click(
      within(screen.getByRole("menuitem", { name: "Geocerca" })).getByRole(
        "button"
      )
    );
    expect(nuevoLugar).toHaveBeenCalledOnce();
    expect(nuevoTrayecto).not.toHaveBeenCalled();

    fireEvent.click(agregar);
    fireEvent.click(
      within(screen.getByRole("menuitem", { name: "Trayecto" })).getByRole(
        "button"
      )
    );
    expect(nuevoTrayecto).toHaveBeenCalledOnce();
  });

  it("lists outside geofences read-only, follows the search and flies to them", () => {
    const irAPunto = vi.fn();
    const ws = (busca: string) =>
      ({
        busca,
        setBusca: vi.fn(),
        lugares: [],
        todosLugares: [],
        editandoLugarId: null,
        modo: "ver",
        irALugar: vi.fn(),
        editarLugar: vi.fn(),
        borrarLugar: vi.fn(),
        setHoveredPlaceId: vi.fn(),
        todosTrayectos: [],
        versionDe: () => "1.0.0",
        editandoTrayId: null,
        irATrayecto: vi.fn(),
        editarTrayecto: vi.fn(),
        borrarTrayecto: vi.fn(),
        abrirImport: vi.fn(),
        irAPunto,
        puedeEditar: true,
      }) as unknown as PlacesWorkspace;
    const externas = {
      titulo: "Geocercas del viaje",
      items: [
        {
          id: "o",
          nombre: "Planta Quilicura",
          detalle: "Origen del viaje",
          ancla: [-33.36, -70.73] as [number, number],
        },
        {
          id: "d",
          nombre: "Puerto San Antonio",
          detalle: "Destino del viaje",
          ancla: [-33.58, -71.61] as [number, number],
        },
      ],
    };
    const { rerender } = render(
      <PlacesCatalogLists ws={ws("")} externas={externas} />
    );
    expect(screen.getByText("Geocercas del viaje")).toBeInTheDocument();
    expect(screen.getByText("Origen del viaje")).toBeInTheDocument();
    // read-only: no edit menu, no checkbox
    expect(
      screen.queryByRole("button", { name: "Opciones de Planta Quilicura" })
    ).toBeNull();
    expect(
      screen.queryByRole("checkbox", { name: "Seleccionar Planta Quilicura" })
    ).toBeNull();
    fireEvent.click(screen.getByText("Puerto San Antonio"));
    expect(irAPunto).toHaveBeenCalledWith([-33.58, -71.61]);

    rerender(<PlacesCatalogLists ws={ws("quilicura")} externas={externas} />);
    expect(screen.getByText("Planta Quilicura")).toBeInTheDocument();
    expect(screen.queryByText("Puerto San Antonio")).toBeNull();
  });
});
