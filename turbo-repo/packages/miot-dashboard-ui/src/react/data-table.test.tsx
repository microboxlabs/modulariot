// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataTable, type DataTableProps } from "./data-table";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function props(): DataTableProps {
  return {
    columns: [
      { key: "service", label: "Service", type: "text", sticky: true },
      { key: "cost", label: "Cost", type: "signed" },
      { key: "share", label: "Share", type: "progress", sticky: true },
    ],
    rows: [{ id: "one", service: "<img>", cost: "-2", share: "25" }],
    label: "Costs",
    emptyLabel: "No rows",
    loadingLabel: "Loading",
    actionsLabel: "Actions",
    resolveValue: (key, row) => row[key] ?? "",
  };
}
it("renders literal cells, decorators and host headers/actions over provided rows", () => {
  const options = props();
  const view = render(
    <DataTable
      {...options}
      columns={options.columns.map((col) => ({
        ...col,
        decorator: col.key === "cost" ? "USD" : undefined,
      }))}
      renderHeader={(_, label) => <span>{label}</span>}
      renderActions={(row) => <a href={`#${row.id}`}>View</a>}
    />,
  );
  expect(screen.getByRole("table", { name: "Costs" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Service" })).toBeTruthy();
  expect(screen.getByText("<img>")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByText("USD")).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toBe("#one");
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("25");
});
it("measures unscaled sticky groups including action width, then updates after columns change", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.textContent === "Actions" ? 40 : 100;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.textContent === "Actions" ? 20 : 50,
        height: 30,
        top: 0,
        left: 0,
        right: 100,
        bottom: 30,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    },
  );
  const options = props();
  const view = render(
    <DataTable
      {...options}
      renderActions={() => <button type="button">Open</button>}
    />,
  );
  const first = screen.getByRole("columnheader", { name: "Service" });
  const last = screen.getByRole("columnheader", { name: "Share" });
  expect(first.style.left).toBe("0px");
  expect(last.style.right).toBe("40px");
  view.rerender(
    <DataTable
      {...options}
      columns={options.columns.map((c) => ({ ...c, sticky: true }))}
    />,
  );
  expect(screen.getByRole("columnheader", { name: "Share" }).style.left).toBe(
    "200px",
  );
  expect(screen.getByRole("columnheader", { name: "Share" }).style.right).toBe(
    "",
  );
});
it("hides rows during loading/errors and renders an empty state after recovery", () => {
  const options = props();
  const view = render(<DataTable {...options} loading />);
  expect(screen.getByRole("status").textContent).toBe("Loading");
  expect(screen.queryByRole("table")).toBeNull();
  view.rerender(<DataTable {...options} errorLabel="Unavailable" />);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByText("<img>")).toBeNull();
  view.rerender(<DataTable {...options} rows={[]} />);
  expect(screen.getByRole("cell").getAttribute("colspan")).toBe("3");
  expect(screen.getByText("No rows")).toBeTruthy();
});

it("supports validated hex row tints without dropping legacy color names", () => {
  const view = render(<DataTable {...props()} rowColor={() => "ef4444"} />);
  const row = screen.getAllByRole("row")[1]!;
  expect(row.style.getPropertyValue("--miot-row-background")).toBe(
    "color-mix(in srgb, #ef4444 12%, var(--miot-card-background, #fff))",
  );
  view.rerender(<DataTable {...props()} rowColor={() => "red"} />);
  expect(row.dataset.rowColor).toBe("red");
  expect(row.style.getPropertyValue("--miot-row-background")).toBe("");
  view.rerender(<DataTable {...props()} rowColor={() => "url(secret)"} />);
  expect(row.style.getPropertyValue("--miot-row-background")).toBe("");
});
