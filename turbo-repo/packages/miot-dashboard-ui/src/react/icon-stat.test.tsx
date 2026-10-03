// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { IconStat } from "./icon-stat";
afterEach(cleanup);
it("renders literal values and host-supplied content in both layouts", () => {
  const view = render(<IconStat title="<img src=x>" value="1,234" unit="USD" description={<em>Billing</em>} icon={<svg />} iconStyle={{ color: "red" }} valueStyle={{ color: "blue" }} />);
  const card = screen.getByRole("article", { name: "<img src=x>" });
  expect(card.dataset.variant).toBe("horizontal");
  expect(card.querySelector("strong")?.textContent).toBe("1,234USD");
  expect(card.querySelector("strong")?.style.color).toBe("blue");
  expect(card.querySelector("em")?.textContent).toBe("Billing");
  expect(card.querySelector("img")).toBeNull();
  expect(card.querySelector("svg")?.parentElement?.getAttribute("aria-hidden")).toBe("true");
  view.rerender(<IconStat title="Cost" value="42" variant="vertical" scalable />);
  expect(card.dataset.variant).toBe("vertical");
  expect(card.dataset.scalable).toBe("true");
  expect(card.querySelector("svg")).toBeNull();
  expect(card.querySelector("em")).toBeNull();
});
