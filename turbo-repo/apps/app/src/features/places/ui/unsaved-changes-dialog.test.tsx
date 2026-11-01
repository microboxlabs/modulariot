import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UnsavedChangesDialog from "./unsaved-changes-dialog";

const props = () => ({
  onSalir: vi.fn(),
  onSeguir: vi.fn(),
});

describe("UnsavedChangesDialog", () => {
  it("is not shown while closed", () => {
    render(<UnsavedChangesDialog abierto={false} {...props()} />);
    expect(screen.queryByText("Cambios sin guardar")).toBeNull();
  });

  it("offers only to leave without saving or to keep editing", () => {
    const p = props();
    render(<UnsavedChangesDialog abierto {...p} />);
    expect(
      screen.getByText(
        "Tienes cambios sin guardar. Si sales ahora, se perderán."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(p.onSalir).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(p.onSeguir).toHaveBeenCalled();
  });
});
