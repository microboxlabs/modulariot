// @vitest-environment jsdom
import { useRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTableColumnWidths } from "./use-table-column-widths";
const columns = [{ key: "first" }, { key: "second" }, { key: "last" }];
const measure = () => {};
function Host({
  editable = false,
  onCommit = () => {},
  savedWidths,
}: {
  readonly editable?: boolean;
  readonly onCommit?: (w: Record<string, number>) => void;
  readonly savedWidths?: Record<string, number>;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const controls = useTableColumnWidths({
    columns,
    savedWidths,
    tableRef,
    headerRowRef,
    hasActions: false,
    editable,
    onCommit,
    measureStickyOffsets: measure,
  });
  return (
    <>
      <table ref={tableRef} style={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          {columns.map((c, i) => (
            <col
              key={c.key}
              ref={(el) => {
                controls.colRefs.current[i] = el;
              }}
              style={{ width: controls.columnWidths[i] ?? undefined }}
            />
          ))}
        </colgroup>
        <thead>
          <tr ref={headerRowRef}>
            {columns.map((c, i) => (
              <th
                key={c.key}
                ref={(el) => {
                  controls.thRefs.current[i] = el;
                }}
              >
                <button
                  type="button"
                  onMouseDown={(e) => controls.handleResizeMouseDown(e, i)}
                  onDoubleClick={() => controls.autoFitColumn(i)}
                >
                  {c.key}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map((c) => (
              <td key={c.key}>{c.key}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <output>{JSON.stringify(controls.columnWidths)}</output>
    </>
  );
}
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === "TABLE" ? 500 : 100;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});
it("persists only once on completed edit-mode resize, excluding the filling last column", () => {
  const onCommit = vi.fn();
  render(<Host editable onCommit={onCommit} />);
  fireEvent.mouseDown(screen.getByRole("button", { name: "first" }), {
    clientX: 10,
  });
  fireEvent.mouseMove(document, { clientX: 60 });
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.mouseUp(document, { clientX: 60 });
  expect(onCommit).toHaveBeenCalledExactlyOnceWith({ first: 150, second: 100 });
  expect(document.body.style.cursor).toBe("");
});
it("keeps viewer resizing local and restores previous document styles after unmount", () => {
  const onCommit = vi.fn();
  const view = render(<Host onCommit={onCommit} />);
  document.body.style.cursor = "wait";
  document.body.style.userSelect = "text";
  fireEvent.mouseDown(screen.getByRole("button", { name: "first" }), {
    clientX: 10,
  });
  fireEvent.mouseUp(document, { clientX: 60 });
  expect(onCommit).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain("150");
  fireEvent.mouseDown(screen.getByRole("button", { name: "first" }), {
    clientX: 10,
  });
  view.unmount();
  expect(document.body.style.cursor).toBe("wait");
  expect(document.body.style.userSelect).toBe("text");
  fireEvent.mouseUp(document, { clientX: 90 });
  expect(onCommit).not.toHaveBeenCalled();
});
it("restores saved widths after undo and ignores nonfinite saved values", () => {
  const view = render(<Host savedWidths={{ first: 160, second: Infinity }} />);
  expect(screen.getByRole("status").textContent).toBe("[160,100,null]");
  view.rerender(<Host savedWidths={{ first: 120, second: 140 }} />);
  expect(screen.getByRole("status").textContent).toBe("[120,140,null]");
});

it("preserves the host inline layout when measuring and auto-fitting", () => {
  const onCommit = vi.fn();
  render(<Host editable onCommit={onCommit} savedWidths={{ first: 160 }} />);
  const table = screen.getByRole("table");
  expect(table.style.tableLayout).toBe("fixed");
  expect(table.style.width).toBe("100%");
  fireEvent.doubleClick(screen.getByRole("button", { name: "first" }));
  expect(onCommit).toHaveBeenCalledExactlyOnceWith({ first: 100, second: 100 });
  expect(table.style.tableLayout).toBe("fixed");
  expect(table.style.width).toBe("100%");
});
