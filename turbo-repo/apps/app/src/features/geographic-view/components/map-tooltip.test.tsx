import { fireEvent, render, screen } from "@testing-library/react";
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

  it("preserves the centered position when dragging starts", () => {
    conAltos(600, 200);
    const { container } = render(
      <MapTooltip left={20} top={20} centrarVertical setHoverInfo={vi.fn()}>
        <p>Drag summary</p>
      </MapTooltip>
    );
    const card = screen.getByText("Drag summary").parentElement!;
    expect(card.style.top).toBe("200px");
    fireEvent.mouseDown(container.querySelector(".cursor-move")!, {
      clientX: 30,
      clientY: 220,
    });
    expect(card.style.top).toBe("200px");
    fireEvent.mouseMove(window, { clientX: 40, clientY: 250 });
    expect(card.style.top).toBe("230px");
    fireEvent.mouseUp(window);
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
