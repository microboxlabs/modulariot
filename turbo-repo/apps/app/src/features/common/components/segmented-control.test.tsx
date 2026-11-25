import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

const options = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Beta" },
] as const;

describe("SegmentedControl", () => {
  it("marks the chosen option for each kind", () => {
    const { rerender } = render(
      <SegmentedControl options={options} value="a" onChange={() => {}} />
    );
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    rerender(
      <SegmentedControl
        kind="tabs"
        label="View"
        options={options}
        value="b"
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    rerender(
      <SegmentedControl
        kind="radio"
        label="Pick"
        options={options}
        value="a"
        onChange={() => {}}
      />
    );
    expect(
      screen.getByRole("radiogroup", { name: "Pick" })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("reports the option picked", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl options={options} value="a" onChange={onChange} />
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
