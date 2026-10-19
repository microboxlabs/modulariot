// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InfoCard } from "./info-card";
afterEach(cleanup);
const props = {
  title: "<img>",
  value: "42",
  descriptor: "Cost",
  footer: "Summary",
  addDetailLabel: "Agregar detalle",
  viewMoreLabel: "Ver más",
};
it("renders literal content and permits only web navigation", () => {
  const view = render(<InfoCard {...props} viewMoreUrl="/report" />);
  expect(screen.getByRole("link").getAttribute("rel")).toBe(
    "noopener noreferrer",
  );
  expect(view.container.querySelector("img")).toBeNull();
  view.rerender(
    <InfoCard {...props} viewMoreUrl="https://example.com" openInSameTab />,
  );
  expect(screen.getByRole("link").getAttribute("target")).toBe("_self");
  for (const viewMoreUrl of [
    "javascript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,hello",
    "mailto:test@example.com",
    "",
  ]) {
    view.rerender(<InfoCard {...props} viewMoreUrl={viewMoreUrl} />);
    expect(screen.queryByRole("link")).toBeNull();
  }
});
it("shows nested content and gates the add-detail action on host editing", () => {
  const add = vi.fn();
  const view = render(<InfoCard {...props} onAddDetail={add} />);
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<InfoCard {...props} editMode onAddDetail={add} />);
  fireEvent.click(screen.getByRole("button", { name: "Agregar detalle" }));
  expect(add).toHaveBeenCalledOnce();
  view.rerender(
    <InfoCard {...props} editMode onAddDetail={add}>
      <p>Nested widget</p>
    </InfoCard>,
  );
  expect(screen.getByText("Nested widget")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<InfoCard {...props} editMode />);
  expect(screen.queryByRole("button")).toBeNull();
});
