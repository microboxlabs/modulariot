// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DetailedStat } from "./detailed-stat";
afterEach(cleanup);
const props = {
  title: "<img>",
  value: "$84,500",
  description: "Monthly revenue",
  previousValue: "$72,000",
  target: "$100,000",
  changeLabel: "+17.4%",
  positive: true,
  progress: 84.5,
  progressLabel: "Progreso",
  progressSummary: "85% alcanzado",
  previousLabel: "Período anterior",
};
it("renders literal formatted values, translated labels and accessible progress", () => {
  const view = render(
    <DetailedStat
      {...props}
      valueColor="ff0000"
      barColor="00ff00"
      badgeColor="0000ff"
    />,
  );
  expect(screen.getByRole("article", { name: "<img>" })).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  expect(
    screen.getByRole("progressbar", { name: "Progreso" }).getAttribute("value"),
  ).toBe("84.5");
  expect(screen.getByText("$84,500").style.color).toBe("rgb(255, 0, 0)");
  expect(screen.getByText("+17.4%").style.color).toBe("rgb(0, 0, 255)");
  expect(screen.getByRole("definition").textContent).toBe("$72,000");
  expect(screen.getByRole("term").textContent).toBe("Período anterior");
});
it("clamps progress and ignores invalid colors when values change", () => {
  const view = render(<DetailedStat {...props} progress={125} />);
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("100");
  for (const progress of [-10, Number.NaN, Number.POSITIVE_INFINITY]) {
    view.rerender(
      <DetailedStat
        {...props}
        progress={progress}
        positive={false}
        changeLabel="-20%"
        valueColor="url(secret)"
        barColor="red"
        badgeColor="#ff0000"
      />,
    );
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
    expect(screen.getByText("$84,500").style.color).toBe("");
    expect(screen.getByText("-20%").style.color).toBe("");
    expect(screen.getByText("-20%").getAttribute("data-positive")).toBe(
      "false",
    );
    expect(
      screen
        .getByRole("progressbar")
        .style.getPropertyValue("--miot-progress-color"),
    ).toBe("");
  }
});
