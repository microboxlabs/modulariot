import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlaceBadgeTooltip, {
  MAX_NOMBRES_CLUSTER,
  posicionTooltip,
} from "./place-badge-tooltip";
import type { ItemNombre } from "./place-labels";
import { CATEGORIAS_KEY, type Lugar } from "../places.types";

vi.mock("../ui/place-categories-field", () => ({
  CAMPO_CATEGORIAS: "place_categories",
  useListaCampo: () => ({
    lang: "es",
    puedeConfigurar: false,
    hydrated: true,
    lista: { key: "place_categories" },
    opciones: [{ value: "bodega", label: { es: "Bodega" }, color: "blue" }],
  }),
}));

const lugar = {
  place_id: "p",
  name: "Planta",
  category: "Zona de carga",
  metadata: { [CATEGORIAS_KEY]: '["bodega","vieja"]' },
} as unknown as Lugar;

const item = (over: Partial<ItemNombre> = {}): ItemNombre => ({
  id: "p",
  name: "Planta",
  color: "#1C64F2",
  icon: "",
  ancla: [0, 0],
  lugar,
  ...over,
});

describe("PlaceBadgeTooltip", () => {
  it("shows the geofence's categories and its alert category", () => {
    const it0 = item();
    render(
      <PlaceBadgeTooltip badge={{ item: it0, miembros: [it0] }} x={10} y={20} />
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Planta");
    const cats = screen.getByRole("list", { name: "Categorías" });
    expect(cats).toHaveTextContent("Bodega");
    // a code no longer in the list still shows
    expect(cats).toHaveTextContent("vieja");
    expect(screen.getByText("Zona de carga")).toBeInTheDocument();
  });

  it("says when a geofence has no categories", () => {
    const sin = item({ lugar: { ...lugar, metadata: null, category: null } });
    render(
      <PlaceBadgeTooltip badge={{ item: sin, miembros: [sin] }} x={0} y={0} />
    );
    expect(screen.getByText("Sin categorías")).toBeInTheDocument();
  });

  it("lists the names grouped in a cluster", () => {
    const a = item({ id: "a", name: "Uno" });
    const b = item({ id: "b", name: "Dos" });
    render(
      <PlaceBadgeTooltip badge={{ item: a, miembros: [a, b] }} x={0} y={0} />
    );
    expect(screen.getByText("2 geocercas")).toBeInTheDocument();
    expect(screen.getByText("Dos")).toBeInTheDocument();
  });

  it("names a route badge and counts routes in a cluster", () => {
    const ruta = item({
      id: "t1",
      name: "Ruta 68",
      trayectoId: "t1",
      lugar: undefined,
    });
    const { rerender } = render(
      <PlaceBadgeTooltip badge={{ item: ruta, miembros: [ruta] }} x={0} y={0} />
    );
    expect(screen.getByText("Trayecto")).toBeInTheDocument();
    expect(screen.queryByText("Importada (aún sin guardar)")).toBeNull();

    const otra = item({
      id: "t2",
      name: "Ruta 5",
      trayectoId: "t2",
      lugar: undefined,
    });
    rerender(
      <PlaceBadgeTooltip
        badge={{ item: ruta, miembros: [ruta, otra] }}
        x={0}
        y={0}
      />
    );
    expect(screen.getByText("2 trayectos")).toBeInTheDocument();
    // mixed: one group per kind, each with its names
    const g1 = item({ id: "g1", name: "Planta" });
    const g2 = item({ id: "g2", name: "Bodega" });
    rerender(
      <PlaceBadgeTooltip
        badge={{ item: ruta, miembros: [g1, ruta, g2] }}
        x={0}
        y={0}
      />
    );
    expect(screen.getByText("2 geocercas")).toBeInTheDocument();
    expect(screen.getByText("1 trayecto")).toBeInTheDocument();
    const [geocercas, trayectos] = screen.getAllByRole("list");
    expect(geocercas).toHaveTextContent("PlantaBodega");
    expect(trayectos).toHaveTextContent("Ruta 68");
  });

  it("caps a big cluster's list and counts the rest", () => {
    const miembros = Array.from({ length: 40 }, (_, i) =>
      item({ id: `g${i}`, name: `Geocerca ${i + 1}` })
    );
    render(
      <PlaceBadgeTooltip badge={{ item: miembros[0]!, miembros }} x={0} y={0} />
    );
    expect(screen.getByText("40 geocercas")).toBeInTheDocument();
    // only the first few names, then how many are left
    expect(screen.getAllByRole("listitem")).toHaveLength(
      MAX_NOMBRES_CLUSTER + 1
    );
    expect(screen.getByText("Geocerca 5")).toBeInTheDocument();
    expect(screen.queryByText("Geocerca 6")).toBeNull();
    expect(
      screen.getByText(`+${40 - MAX_NOMBRES_CLUSTER} más`)
    ).toBeInTheDocument();
  });

  it("keeps the card inside the map, flipping it near the edges", () => {
    const tarjeta = { ancho: 200, alto: 150 };
    const mapa = { ancho: 800, alto: 600 };
    // room below-right: next to the cursor
    expect(posicionTooltip({ x: 100, y: 100 }, tarjeta, mapa)).toEqual({
      left: 114,
      top: 114,
    });
    // near the right edge: to the left of the cursor
    expect(posicionTooltip({ x: 700, y: 100 }, tarjeta, mapa).left).toBe(
      700 - 14 - 200
    );
    // near the bottom: above the cursor
    expect(posicionTooltip({ x: 100, y: 550 }, tarjeta, mapa).top).toBe(
      550 - 14 - 150
    );
    // a corner: both flipped, never outside
    const esquina = posicionTooltip({ x: 790, y: 590 }, tarjeta, mapa);
    expect(esquina.left + tarjeta.ancho).toBeLessThanOrEqual(mapa.ancho);
    expect(esquina.top + tarjeta.alto).toBeLessThanOrEqual(mapa.alto);
  });
});
