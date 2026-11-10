import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import TagManager from "./tag-manager";

vi.mock("flowbite-react", () => ({
  Tooltip: ({
    children,
    content,
  }: {
    children: ReactNode;
    content: ReactNode;
  }) => (
    <>
      {children}
      <div role="tooltip">{content}</div>
    </>
  ),
}));

afterEach(() => vi.restoreAllMocks());

describe("TagManager", () => {
  it("keeps a skipped service code in the tooltip when a shorter later tag fits", async () => {
    const code = "ID: SERVICE-DEMO-LONG-CODE";
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        if (this.style.visibility === "hidden") {
          return this.textContent === code ? 300 : 30;
        }
        return 240;
      }
    );

    render(
      <TagManager
        tags={[{ text: code }, { text: "Demo carrier" }]}
        tag_style=""
      />
    );

    expect(await screen.findByText("+1")).toBeTruthy();
    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText(code)).toBeTruthy();
    expect(within(tooltip).queryByText("Demo carrier")).toBeNull();
    expect(screen.getByText("Demo carrier")).toBeTruthy();
  });
});
