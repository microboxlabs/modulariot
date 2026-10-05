import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IconPicker } from "./icons";

describe("IconPicker", () => {
  it("opens the grid and returns the chosen icon", () => {
    const onChange = vi.fn();
    render(
      <IconPicker value="" fallback="pin" accentCls="" onChange={onChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Elegir icono" }));
    expect(screen.getByRole("option", { name: "Ubicación" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(screen.getByRole("option", { name: "Bodega" }));

    expect(onChange).toHaveBeenCalledWith("bodega");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
