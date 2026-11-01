import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapControlsFrame from "./map-controls-frame";

describe("MapControlsFrame", () => {
  it("puts every control group in its corner, all 20 px from the edge", () => {
    render(
      <MapControlsFrame
        topRight={<button type="button">notch</button>}
        bottomLeft={<button type="button">estilo</button>}
      />
    );
    const marco = document.querySelector("[data-map-controls]");
    // one padding for everything, and clicks pass through to the map
    expect(marco).toHaveClass("p-5", "pointer-events-none");
    const notch = screen.getByRole("button", { name: "notch" }).parentElement;
    const estilo = screen.getByRole("button", { name: "estilo" }).parentElement;
    // the corner boxes let the map be dragged around their controls
    expect(notch).toHaveClass("top-0", "right-0", "pointer-events-none");
    expect(estilo).toHaveClass("bottom-0", "left-0", "pointer-events-none");
  });
});
