// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TextCard } from "./text-card";
afterEach(cleanup);
it("renders untrusted text literally and updates alignment and emphasis", () => {
  const view = render(<TextCard text={'<img src=x onerror="alert(1)">'} />);
  expect(view.container.querySelector("img")).toBeNull();
  const text = screen.getByText('<img src=x onerror="alert(1)">');
  expect(text.dataset.align).toBe("left");
  expect(text.dataset.italic).toBe("true");
  view.rerender(<TextCard text="Costs" align="right" italic={false} />);
  expect(screen.getByText("Costs").dataset.align).toBe("right");
  expect(screen.getByText("Costs").dataset.italic).toBe("false");
});
it("supports centered text", () => {
  render(<TextCard text="Centered" align="center" />);
  expect(screen.getByText("Centered").dataset.align).toBe("center");
});
