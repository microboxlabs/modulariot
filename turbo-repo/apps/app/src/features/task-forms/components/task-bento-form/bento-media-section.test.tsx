import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import BentoMediaSection from "./bento-media-section";

// el mapa y el visor reales son pesados: el mapa expone su aviso de Lugares
vi.mock("@/features/shipping/components/geographic", () => ({
  default: ({
    onLugaresChange,
  }: {
    onLugaresChange?: (abierto: boolean) => void;
  }) => (
    <div data-testid="mapa">
      <button type="button" onClick={() => onLugaresChange?.(true)}>
        abrir lugares
      </button>
      <button type="button" onClick={() => onLugaresChange?.(false)}>
        cerrar lugares
      </button>
    </div>
  ),
}));
vi.mock(
  "./components/side-data/multimedia-manager.tsx/gallery/file-images",
  () => ({ default: () => <div data-testid="multimedia">multimedia</div> })
);

const viewport = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/features/layout/hooks/use-media-query", () => ({
  useMediaQuery: () => viewport.desktop,
}));

const task = {
  mintral_serviceCode: "S1",
  mintral_truckLicensePlate: "AB1234",
} as unknown as TaskResponse;
const dict = {} as I18nDictionary;

describe("BentoMediaSection", () => {
  beforeEach(() => {
    viewport.desktop = true;
  });
  it("keeps multimedia available when an open Places map becomes hidden on mobile", () => {
    const { rerender } = render(<BentoMediaSection task={task} dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: "abrir lugares" }));
    const mediaColumn = () =>
      screen.getByTestId("multimedia").parentElement!.parentElement!;
    expect(mediaColumn()).toHaveAttribute("inert");
    viewport.desktop = false;
    rerender(<BentoMediaSection task={task} dict={dict} />);
    expect(mediaColumn()).not.toHaveAttribute("inert");
    expect(mediaColumn()).toHaveAttribute("aria-hidden", "false");
    expect(mediaColumn().style.opacity).not.toBe("0");
    expect(screen.getByTestId("multimedia").parentElement!.style.width).toBe(
      "100%"
    );
  });
  it("gives the map the whole width while Lugares is open", () => {
    render(<BentoMediaSection task={task} dict={dict} />);
    const columnaMapa = () =>
      screen.getByTestId("mapa").parentElement!.parentElement as HTMLElement;
    const contenido = () =>
      screen.getByTestId("multimedia").parentElement as HTMLElement;
    const columnaMultimedia = () => contenido().parentElement as HTMLElement;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(320);

    expect(columnaMapa().style.width).toBe("66.666%");
    expect(columnaMultimedia()).not.toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "abrir lugares" }));
    // the multimedia manager folds away and the map takes it all
    expect(columnaMapa().style.width).toBe("100%");
    expect(columnaMapa().style.marginRight).toBe("0px");
    // keeps flex-grow so it always fills up to the right edge: it closes
    // towards the right, never pulling its right side to the left
    expect(columnaMultimedia().style.flexGrow).toBe("");
    expect(columnaMultimedia()).toHaveClass("flex-1");
    expect(columnaMultimedia().style.opacity).toBe("0");
    expect(columnaMultimedia()).toHaveAttribute("inert");
    // it leaves to the right: content keeps its width and rides on the
    // column's left edge (the one moving right), so it slides out right
    expect(columnaMultimedia()).not.toHaveClass("justify-end");
    expect(contenido()).toHaveClass("shrink-0");
    expect(contenido().style.width).toBe("320px");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "cerrar lugares" }));
    expect(columnaMapa().style.width).toBe("66.666%");
    expect(columnaMultimedia()).not.toHaveAttribute("inert");
    // back in from the right, then free to fill the column again
    expect(contenido().style.width).toBe("320px");
    act(() => vi.advanceTimersByTime(500));
    expect(contenido().style.width).toBe("100%");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
