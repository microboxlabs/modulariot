import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MapTooltip from "./map-tooltip";

/** Sin layout en jsdom: alto del mapa y de la tarjeta, a mano. */
function conAltos(mapa: number, tarjeta: number) {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(mapa);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
    tarjeta
  );
}

describe("MapTooltip", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens where it is told", () => {
    render(
      <MapTooltip left={20} top={30} setHoverInfo={vi.fn()}>
        <p>Resumen</p>
      </MapTooltip>
    );
    const tarjeta = screen.getByText("Resumen").parentElement as HTMLElement;
    expect(tarjeta.style.left).toBe("20px");
    expect(tarjeta.style.top).toBe("30px");
  });

  it("can open centred in the map's height, at its left", () => {
    conAltos(600, 200);
    render(
      <MapTooltip left={20} top={20} centrarVertical setHoverInfo={vi.fn()}>
        <p>Resumen</p>
      </MapTooltip>
    );
    const tarjeta = screen.getByText("Resumen").parentElement as HTMLElement;
    expect(tarjeta.style.left).toBe("20px");
    // (600 - 200) / 2
    expect(tarjeta.style.top).toBe("200px");
  });
});
