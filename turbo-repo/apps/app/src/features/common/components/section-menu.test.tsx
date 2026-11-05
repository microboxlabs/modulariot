import { render, screen } from "@testing-library/react";
import { HiOutlineCreditCard, HiOutlinePhone } from "react-icons/hi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SectionMenu, { type SectionMenuEntry } from "./section-menu";

const scrollIntoView = vi.hoisted(() => vi.fn());

const sections: readonly SectionMenuEntry<"tenants" | "plan">[] = [
  {
    id: "tenants",
    label: "Organizaciones",
    description: "Who has telephony",
    icon: HiOutlinePhone,
    group: "Telefonía",
  },
  {
    id: "plan",
    label: "Plan",
    description: "Prices",
    icon: HiOutlineCreditCard,
    group: "Telefonía",
  },
];

describe("SectionMenu", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    scrollIntoView.mockReset();
  });

  it("scrolls the selected item into view on open", () => {
    render(
      <SectionMenu
        title="Menu"
        sections={sections}
        selected="plan"
        onSelect={() => {}}
      />
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(
      screen.getByRole("button", { name: /Plan/ })
    );
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("scrolls again when the selection changes", () => {
    const { rerender } = render(
      <SectionMenu
        title="Menu"
        sections={sections}
        selected="tenants"
        onSelect={() => {}}
      />
    );
    rerender(
      <SectionMenu
        title="Menu"
        sections={sections}
        selected="plan"
        onSelect={() => {}}
      />
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.contexts[1]).toBe(
      screen.getByRole("button", { name: /Plan/ })
    );
  });

  it("lets the item list scroll on its own from md", () => {
    render(
      <SectionMenu
        title="Menu"
        sections={sections}
        selected="tenants"
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole("list")).toHaveClass(
      "md:min-h-0",
      "md:overflow-y-auto"
    );
    expect(screen.getByRole("complementary")).toHaveClass("md:max-h-full");
  });
});
