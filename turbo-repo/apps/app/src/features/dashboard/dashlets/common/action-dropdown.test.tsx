// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ActionDropdown } from "./action-dropdown";
afterEach(cleanup);
it("keeps valid siblings while suppressing unsafe and empty draft destinations", () => {
  const action = { name: "Open", link: "", target: "_self" as const };
  render(<ActionDropdown ariaLabel="Actions" items={[
    { action, href: "/safe" },
    { action: { ...action, name: "Draft" }, href: "" },
    { action: { ...action, name: "Unsafe" }, href: "java\nscript:alert(1)" },
  ]} />);
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/safe");
});
