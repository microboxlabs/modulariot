import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IconPicker, claveIcono } from "./icons";

describe("claveIcono", () => {
  it("keeps dashboard registry keys and maps legacy place ids", () => {
    expect(claveIcono("hi2-truck")).toBe("hi2-truck");
    expect(claveIcono("pin")).toBe("hi2-outline-map-pin");
    expect(claveIcono("ruta")).toBe("tb-route");
  });
});

describe("IconPicker", () => {
  it("opens the dashboard icon grid and returns the chosen registry key", () => {
    const onChange = vi.fn();
    render(<IconPicker value="" fallback="pin" onChange={onChange} />);

    fireEvent.click(screen.getByTitle("Elegir icono"));
    fireEvent.change(screen.getByPlaceholderText("Buscar iconos…"), {
      target: { value: "hi2-truck" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Truck" }));

    expect(onChange).toHaveBeenCalledWith("hi2-truck");
  });
});
