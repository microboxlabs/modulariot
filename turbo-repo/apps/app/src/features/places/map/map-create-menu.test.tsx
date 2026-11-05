import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MapCreateMenu from "./map-create-menu";

describe("MapCreateMenu", () => {
  it("offers create actions for place and route and closes on Escape", () => {
    const onCrearLugar = vi.fn();
    const onCrearTrayecto = vi.fn();
    const onClose = vi.fn();
    render(
      <MapCreateMenu
        x={100}
        y={50}
        onCrearLugar={onCrearLugar}
        onCrearTrayecto={onCrearTrayecto}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Crear lugar" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Crear trayecto" }));
    expect(
      screen.queryByRole("menuitem", { name: "Crear circuito" })
    ).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCrearLugar).toHaveBeenCalledOnce();
    expect(onCrearTrayecto).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
