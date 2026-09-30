// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ActionDropdown, type ResolvedAction } from "./action-dropdown";
afterEach(cleanup);
const item: ResolvedAction = {
  action: { name: "<img> Report", link: "/report", target: "_blank" },
  href: "/report",
};
it("filters unsafe resolved destinations, protects new windows and keeps labels literal", () => {
  const view = render(
    <ActionDropdown
      ariaLabel="Actions"
      items={[item, { ...item, href: "java\nscript:alert(1)" }]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  const link = screen.getByRole("link", { name: "<img> Report" });
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(document.querySelector("img")).toBeNull();
  expect(document.activeElement).toBe(link);
  fireEvent.keyDown(link, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button"));
  view.rerender(
    <ActionDropdown
      ariaLabel="Actions"
      items={[{ ...item, href: "data:text/html,hi" }]}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
});
it("closes on focus exit and does not bubble trigger clicks to row actions", () => {
  const rowClick = vi.fn();
  render(
    <>
      <ActionDropdown ariaLabel="Actions" items={[item]} />
      <button type="button">Outside</button>
    </>,
  );
  // A native host listener lives outside the React mount root.
  document.body.addEventListener("click", rowClick);
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  document.body.removeEventListener("click", rowClick);
  expect(rowClick).not.toHaveBeenCalled();
  const outside = screen.getByRole("button", { name: "Outside" });
  act(() => outside.focus());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(outside);
});
it("closes when actions disappear and when its scroll container moves", () => {
  const view = render(<ActionDropdown ariaLabel="Actions" items={[item]} />);
  fireEvent.click(screen.getByRole("button"));
  view.rerender(<ActionDropdown ariaLabel="Actions" items={[]} />);
  view.rerender(<ActionDropdown ariaLabel="Actions" items={[item]} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  fireEvent.scroll(window);
  expect(screen.queryByRole("dialog")).toBeNull();
});
