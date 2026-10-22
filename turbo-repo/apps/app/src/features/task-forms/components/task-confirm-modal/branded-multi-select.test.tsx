import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BrandedMultiSelect from "./branded-multi-select";

const props = {
  options: [
    { value: "a", label: "Uno" },
    { value: "b", label: "Dos" },
  ],
  placeholder: "Elegir",
  summaryLabel: (n: number) => `${n} elegidas`,
  emptyLabel: "Sin opciones",
};

describe("BrandedMultiSelect", () => {
  it("offers a clear row inside the list when asked to", () => {
    const onSelectionChange = vi.fn();
    render(
      <BrandedMultiSelect
        {...props}
        selectedValues={["a", "b"]}
        onSelectionChange={onSelectionChange}
        clearLabel="Limpiar selección"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "2 elegidas" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar selección" }));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("has no clear row by default", () => {
    render(
      <BrandedMultiSelect
        {...props}
        selectedValues={["a"]}
        onSelectionChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Uno" }));
    expect(screen.queryByText("Limpiar selección")).toBeNull();
  });
});
