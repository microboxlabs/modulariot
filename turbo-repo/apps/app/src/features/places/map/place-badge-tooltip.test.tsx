import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlaceBadgeTooltip from "./place-badge-tooltip";
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
});
