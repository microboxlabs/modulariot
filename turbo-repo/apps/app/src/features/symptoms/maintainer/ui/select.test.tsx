import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Select from "./select";

describe("Select", () => {
  it("hides the browser arrow, keeps room for its own and passes props", () => {
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Operador"
        className="px-2"
        wrapperClassName="flex-1"
        value="b"
        onChange={onChange}
      >
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    const select = screen.getByLabelText("Operador") as HTMLSelectElement;
    expect(select.className).toContain("appearance-none");
    expect(select.className).toContain("pr-7");
    expect(select.parentElement?.className).toContain("flex-1");
    fireEvent.change(select, { target: { value: "a" } });
    expect(onChange).toHaveBeenCalled();
  });
});
