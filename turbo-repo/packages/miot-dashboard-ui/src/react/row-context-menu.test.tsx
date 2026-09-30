// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RowContextMenu, type ResolvedContextItem } from "./row-context-menu";
const items: ResolvedContextItem[] = [
  {
    action: {
      method: "goto",
      name: "<b>View record</b>",
      link: "",
      target: "_blank",
    },
    href: "https://example.com/record",
  },
  {
    action: { method: "goto", name: "Unsafe", link: "", target: "_self" },
    href: "java\nscript:alert(1)",
  },
];
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("filters unsafe resolved navigation, focuses literal links and restores focus on Escape", () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const onClose = vi.fn();
  render(
    <RowContextMenu
      items={items}
      x={12}
      y={20}
      ariaLabel="Row actions"
      onClose={onClose}
      returnFocusTo={trigger}
      theme="dark"
    />,
  );
  const link = screen.getByRole("link", { name: "<b>View record</b>" });
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.querySelector("b")).toBeNull();
  expect(screen.queryByRole("link", { name: "Unsafe" })).toBeNull();
  expect(document.activeElement).toBe(link);
  expect(screen.getByRole("dialog").dataset.miotTheme).toBe("dark");
  fireEvent.keyDown(link, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
it("clamps the menu, dismisses on outside interaction and removes listeners on unmount", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 200,
    bottom: 100,
    width: 200,
    height: 100,
    toJSON: () => ({}),
  });
  const onClose = vi.fn();
  const view = render(
    <RowContextMenu
      items={items}
      x={9999}
      y={9999}
      ariaLabel="Actions"
      onClose={onClose}
    />,
  );
  const menu = screen.getByRole("dialog");
  expect(menu.style.left).toBe(`${window.innerWidth - 208}px`);
  expect(menu.style.top).toBe(`${window.innerHeight - 108}px`);
  fireEvent.pointerDown(menu);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.pointerDown(document.body);
  expect(onClose).toHaveBeenCalledOnce();
  view.unmount();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.pointerDown(document.body);
  expect(onClose).toHaveBeenCalledOnce();
});
it("does not render unsafe-only menus and does not bubble navigation to the host row", () => {
  const onClose = vi.fn(),
    rowClick = vi.fn();
  const view = render(
    <div onClick={rowClick}>
      <RowContextMenu
        items={items}
        x={0}
        y={0}
        ariaLabel="Actions"
        onClose={onClose}
      />
    </div>,
  );
  const link = screen.getByRole("link");
  link.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(link);
  expect(rowClick).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
  view.rerender(
    <RowContextMenu
      items={[items[1]!]}
      x={0}
      y={0}
      ariaLabel="Actions"
      onClose={onClose}
    />,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
