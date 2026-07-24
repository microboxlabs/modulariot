import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortBadge } from "./sort-badge";

const OPTIONS = [
  { value: "NAME_ASC", label: "Name (A-Z)" },
  { value: "NAME_DESC", label: "Name (Z-A)" },
  { value: "CREATED_DESC", label: "Last created" },
  { value: "UPDATED_DESC", label: "Last updated" },
];

/**
 * jsdom reports a zero rect for every element, so the trigger's position has to
 * be faked to exercise the panel placement.
 */
function placeTriggerAt(left: number, right: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: 40,
    left,
    right,
    width: right - left,
    height: 32,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function setup(value = "UPDATED_DESC") {
  const onChange = vi.fn();
  render(
    <SortBadge
      label="Sort"
      value={value}
      defaultValue="UPDATED_DESC"
      options={OPTIONS}
      onChange={onChange}
    />
  );
  return { onChange, user: userEvent.setup() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SortBadge", () => {
  it("stays idle while the default order is selected", () => {
    setup("UPDATED_DESC");

    expect(screen.getByRole("button", { name: "Sort" })).toBeVisible();
  });

  it("shows the chosen order once it differs from the default", () => {
    setup("NAME_ASC");

    expect(screen.getByText("Sort:")).toBeVisible();
    expect(screen.getByText("Name (A-Z)")).toBeVisible();
  });

  it("selects a single option and closes", async () => {
    const { user, onChange } = setup();

    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.click(screen.getByText("Name (Z-A)"));

    expect(onChange).toHaveBeenCalledWith("NAME_DESC");
    expect(screen.queryByText("Last created")).toBeNull();
  });

  it("anchors the panel to the left edge of a trigger on the left", async () => {
    window.innerWidth = 1000;
    placeTriggerAt(120, 200);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Sort" }));

    const panel = screen.getByText("Name (A-Z)").closest("div");
    expect(panel).toHaveStyle({ left: "120px" });
  });

  it("anchors to the right edge when the trigger sits near the right, so the panel can't run off screen", async () => {
    window.innerWidth = 1000;
    placeTriggerAt(880, 960);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Sort" }));

    const panel = screen.getByText("Name (A-Z)").closest("div");
    // 1000 - 960: the panel's right edge lines up with the trigger's.
    expect(panel).toHaveStyle({ right: "40px" });
    expect(panel?.style.left).toBe("");
  });
});
