import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InteractiveCard, { INTERACTIVE_CARD_TARGET } from "./interactive-card";

describe("InteractiveCard", () => {
  it("toggles the selection from its checkbox without clicking the card", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onClick = vi.fn();
    render(
      <InteractiveCard
        aria-label="Fleet"
        onClick={onClick}
        selection={{ checked: false, label: 'Select "Fleet"', onToggle }}
      >
        Fleet
      </InteractiveCard>
    );
    const checkbox = screen.getByRole("checkbox", { name: 'Select "Fleet"' });
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    await user.click(checkbox);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("has no checkbox when it can't be selected", () => {
    render(<InteractiveCard>Report</InteractiveCard>);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("puts the selector before the content and the actions after it", () => {
    render(
      <InteractiveCard
        as="li"
        aria-label="Fleet"
        selection={{ checked: true, label: "Select", onToggle: vi.fn() }}
        actions={<button type="button">Star</button>}
        media={<span>preview</span>}
      >
        <span>body</span>
      </InteractiveCard>
    );
    const card = screen.getByRole("listitem", { name: "Fleet" });
    const order = [
      screen.getByRole("checkbox"),
      screen.getByText("preview"),
      screen.getByText("body"),
      screen.getByRole("button", { name: "Star" }),
    ];
    order.slice(1).forEach((el, i) => {
      expect(
        order[i]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });
    expect(card).toContainElement(order[0]!);
  });

  it("passes other props to its root, so callers can wire drag and menus", () => {
    const onContextMenu = vi.fn();
    render(
      <InteractiveCard
        as="li"
        aria-label="Ops"
        layout="row"
        data-keep-selection
        onContextMenu={onContextMenu}
      >
        Ops
      </InteractiveCard>
    );
    const card = screen.getByRole("listitem", { name: "Ops" });
    expect(card).toHaveAttribute("data-keep-selection");
    card.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it("shows selection with the border only", () => {
    const { rerender } = render(
      <InteractiveCard aria-label="Fleet" selected>
        Fleet
      </InteractiveCard>
    );
    const card = screen.getByLabelText("Fleet");
    expect(card.className).toContain("border-blue-500");
    expect(card.className).not.toContain("ring-1");
    rerender(
      <InteractiveCard aria-label="Fleet" selected dropTarget>
        Fleet
      </InteractiveCard>
    );
    expect(card.className).toContain("border-primary-400");
  });

  it("exposes the class that makes a link cover the card", () => {
    expect(INTERACTIVE_CARD_TARGET).toContain("after:inset-0");
  });
});
