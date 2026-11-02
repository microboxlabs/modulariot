import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "en" }) }));
vi.mock("@/features/settings-admin/selectables/store", () => ({
  useSelectables: () => ({
    selectables: [
      {
        key: "demo",
        name: { en: "Demo" },
        mode: "MULTIPLE",
        options: [{ value: "one", label: { en: "Demo option" } }],
      },
    ],
  }),
}));
vi.mock("@/features/settings-admin/selectables/field-bindings", () => ({
  useFieldSelectableBinding: () => ["demo", vi.fn()],
}));
import { SelectableDropdown } from "./prototype-form-kit";
describe("SelectableDropdown clear contract", () => {
  it("calls onClear rather than onSelect for an explicit multiple clear", () => {
    const onClear = vi.fn();
    const onSelect = vi.fn();
    render(
      <SelectableDropdown
        fieldKey="demo"
        dict={{}}
        value="one"
        onSelect={onSelect}
        clearLabel="Clear demo"
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Demo option" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear demo" }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
