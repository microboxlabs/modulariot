import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DateField from "./date-field";

describe("DateField", () => {
  it("shows the date as dd/mm/yyyy", () => {
    render(<DateField label="Desde" value="2026-10-05" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Desde")).toHaveValue("05/10/2026");
  });

  it("opens the Flowbite calendar and clears the value", () => {
    const onChange = vi.fn();
    render(<DateField label="Hasta" value="2026-10-05" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Hasta"));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("closes the calendar on Escape", () => {
    render(<DateField label="Desde" value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Desde"));
    expect(screen.getByRole("button", { name: "Hoy" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("button", { name: "Hoy" })
    ).not.toBeInTheDocument();
  });
});
