import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

const options = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Beta" },
] as const;

function KeyboardControl({
  kind,
  tooltip = false,
}: Readonly<{ kind: "tabs" | "radio" | "toggle"; tooltip?: boolean }>) {
  const [value, setValue] = useState("b");
  return (
    <>
      <button type="button">Before</button>
      <SegmentedControl
        label="Choice"
        kind={kind}
        tooltip={tooltip}
        options={[
          { key: "a", label: "Alpha", title: "First option" },
          { key: "b", label: "Beta", title: "Second option" },
          { key: "c", label: "Gamma", title: "Third option" },
        ]}
        value={value}
        onChange={setValue}
      />
      <button type="button">After</button>
    </>
  );
}

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

  it.each(["tabs", "radio"] as const)(
    "navigates %s with arrows and one Tab entry, including with tooltips",
    async (kind) => {
      const user = userEvent.setup();
      render(<KeyboardControl kind={kind} tooltip />);
      const role = kind === "tabs" ? "tab" : "radio";
      const state = kind === "tabs" ? "aria-selected" : "aria-checked";
      const alpha = screen.getByRole(role, { name: "Alpha" });
      const beta = screen.getByRole(role, { name: "Beta" });
      const gamma = screen.getByRole(role, { name: "Gamma" });

      await user.tab();
      expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
      await user.tab();
      expect(beta).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(gamma).toHaveFocus();
      expect(gamma).toHaveAttribute(state, "true");
      expect(beta).toHaveAttribute(state, "false");
      await user.keyboard("{ArrowRight}");
      expect(alpha).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(gamma).toHaveFocus();
      await user.keyboard("{Home}");
      expect(alpha).toHaveFocus();
      await user.keyboard("{End}");
      expect(gamma).toHaveFocus();
      expect(gamma).toHaveAttribute(state, "true");
      await user.tab();
      expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
      await user.tab({ shift: true });
      expect(gamma).toHaveFocus();
    }
  );

  it("selects radios with vertical arrows", async () => {
    const user = userEvent.setup();
    render(<KeyboardControl kind="radio" />);
    await user.tab();
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Gamma" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Gamma" })).toHaveAttribute(
      "aria-checked", "true"
    );
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute(
      "aria-checked", "true"
    );
  });

  it("leaves vertical arrows available for scrolling in horizontal tabs", async () => {
    const user = userEvent.setup();
    render(<KeyboardControl kind="tabs" />);
    await user.tab();
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowUp}");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "aria-selected", "true"
    );
  });

  it("keeps ordinary Tab and Space behavior for toggle buttons", async () => {
    const user = userEvent.setup();
    render(<KeyboardControl kind="toggle" />);
    await user.tab();
    await user.tab();
    const alpha = screen.getByRole("button", { name: "Alpha" });
    expect(alpha).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(alpha).toHaveFocus();
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    await user.keyboard(" ");
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    await user.tab();
    expect(screen.getByRole("button", { name: "Beta" })).toHaveFocus();
  });
});
