// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { FlexContainer } from "./flex-container";
afterEach(cleanup);
function Counter({ name }: Readonly<{ name: string }>) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{name} {count}</button>;
}
it("preserves keyed child state when the host reorders widgets or changes layout", () => {
  const a = <Counter key="a" name="A" />;
  const b = <Counter key="b" name="B" />;
  const view = render(<FlexContainer title="Costs" emptyLabel="Empty">{[a, b]}</FlexContainer>);
  fireEvent.click(screen.getByText("A 0"));
  view.rerender(<FlexContainer title="Costs" emptyLabel="Empty" layout="column">{[b, a]}</FlexContainer>);
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["B 0", "A 1"]);
  expect(view.container.querySelector("[data-layout]")?.getAttribute("data-layout")).toBe("column");
  view.rerender(<FlexContainer title="Costs" emptyLabel="Empty" layout="grid">{[b, a]}</FlexContainer>);
  expect(screen.getByText("A 1")).toBeTruthy();
  expect(view.container.querySelector("[data-layout]")?.getAttribute("data-layout")).toBe("grid");
});
it("shows localized empty text only in viewing mode", () => {
  const view = render(<FlexContainer title="Costs" emptyLabel="Sin widgets">{null}{false}</FlexContainer>);
  expect(screen.getByText("Sin widgets")).toBeTruthy();
  view.rerender(<FlexContainer title="Costs" emptyLabel="Sin widgets" editMode />);
  expect(screen.queryByText("Sin widgets")).toBeNull();
  expect(view.container.querySelector("[data-layout]")?.getAttribute("data-layout")).toBe("row");
});
it("renders plain text literally and accepts host-rendered descriptions", () => {
  const title = '<img src=x onerror="alert(1)">';
  const view = render(<FlexContainer title={title} emptyLabel="Empty" description={<strong>Billing</strong>} />);
  expect(screen.getByRole("heading").textContent).toBe(title);
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByText("Billing").tagName).toBe("STRONG");
});
