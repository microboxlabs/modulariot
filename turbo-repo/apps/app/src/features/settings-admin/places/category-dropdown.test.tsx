import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CategoryDropdown from "./category-dropdown";

const cats = [
  { category_id: 1, name: "Planta", color: "#FF0000" },
  { category_id: 2, name: "Puerto", color: "#0000FF" },
];

describe("CategoryDropdown", () => {
  it("shows the current category and returns the chosen id", () => {
    const onChange = vi.fn();
    render(<CategoryDropdown value="1" cats={cats} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Categoría: Planta" }));
    fireEvent.click(screen.getByText("Puerto"));

    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("can clear the category", () => {
    const onChange = vi.fn();
    render(<CategoryDropdown value="2" cats={cats} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Categoría: Puerto" }));
    fireEvent.click(screen.getByText("Sin categoría"));

    expect(onChange).toHaveBeenCalledWith("");
  });
});
