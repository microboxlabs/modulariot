// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DataListCard, type DataListCardProps } from "./data-list-card";
afterEach(cleanup);
const options: DataListCardProps = {
  row: {
    title: "<img src=x>",
    subtitle: "Billing service",
    status: "Ready",
    cost: "-12",
    share: "45",
    empty: "",
  },
  rowIdx: 0,
  totalRows: 1,
  columns: [
    { key: "status", label: "Status", type: "badge" },
    { key: "cost", label: "Cost", type: "signed" },
    { key: "share", label: "Share", type: "progress" },
  ],
  cardLayout: {
    titleColumn: "title",
    subtitleColumn: "subtitle",
    headerBadgeColumns: ["status", "empty"],
    kpiColumns: ["cost", "share"],
    footerColumns: ["status"],
  },
  resolveValue: (key, row) => row[key] ?? "",
  resolveLabel: (key) => key.toUpperCase(),
  resolveType: (key) =>
    ({ cost: "signed", share: "progress", status: "badge" })[key] ?? "text",
};
it("renders literal headings, shared formatted metrics and host actions", () => {
  const view = render(
    <DataListCard {...options} actions={<a href="#report">Open report</a>} />,
  );
  expect(screen.getByRole("article", { name: "<img src=x>" })).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByText("Billing service")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("45");
  expect(screen.getByText("-12")).toBeTruthy();
  expect(screen.getByText("COST")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Open report" }).getAttribute("href"),
  ).toBe("#report");
  expect(screen.getAllByText("Ready")).toHaveLength(2);
});
it("omits empty sections and does not render a nonfunctional action button", () => {
  const view = render(
    <DataListCard
      {...options}
      row={{ title: "SQL" }}
      cardLayout={{
        titleColumn: "title",
        subtitleColumn: "subtitle",
        headerBadgeColumns: [],
        kpiColumns: [],
        footerColumns: [],
      }}
    />,
  );
  expect(view.container.querySelector("dl")).toBeNull();
  expect(view.container.querySelector("p")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
