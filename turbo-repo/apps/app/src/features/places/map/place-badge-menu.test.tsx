import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlaceBadgeMenu from "./place-badge-menu";

function setup() {
  const props = {
    x: 10,
    y: 20,
    nombre: "Planta Quilicura",
    onConfigurar: vi.fn(),
    onEliminar: vi.fn(),
    onClose: vi.fn(),
  };
  render(<PlaceBadgeMenu {...props} />);
  return props;
}

describe("PlaceBadgeMenu", () => {
  it("offers settings and delete for the place", () => {
    const p = setup();
    expect(
      screen.getByRole("menu", { name: "Opciones de Planta Quilicura" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Configuración" }));
    expect(p.onConfigurar).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    expect(p.onEliminar).toHaveBeenCalled();
  });

  it("closes with Escape", () => {
    const p = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(p.onClose).toHaveBeenCalled();
  });
});
