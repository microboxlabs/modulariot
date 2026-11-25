import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LayoutToggle from "./layout-toggle";

describe("LayoutToggle", () => {
  it("shows each view with its own icon and says which one is on", async () => {
    const onLayout = vi.fn();
    render(
      <LayoutToggle
        layout="cards"
        labels={{ cards: "Tarjetas", list: "Lista" }}
        onLayout={onLayout}
      />
    );
    const cards = screen.getByRole("button", { name: "Tarjetas" });
    const list = screen.getByRole("button", { name: "Lista" });
    expect(cards).toHaveAttribute("aria-pressed", "true");
    expect(list).toHaveAttribute("aria-pressed", "false");
    // Drawn by the toggle, not typed into the labels.
    expect(cards.querySelector("svg")).not.toBeNull();
    expect(list.querySelector("svg")).not.toBeNull();
    await userEvent.setup().click(list);
    expect(onLayout).toHaveBeenCalledWith("list");
  });
});
