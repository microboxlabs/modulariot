import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

const task = {
  mintral_serviceCode: "S1",
  mintral_truckLicensePlate: "AB1234",
} as unknown as TaskResponse;
const dict = {} as I18nDictionary;

describe("BentoMediaSection", () => {
  it("gives the map the whole width while Lugares is open", () => {
    render(<BentoMediaSection task={task} dict={dict} />);
    const columnaMapa = () =>
      screen.getByTestId("mapa").parentElement!.parentElement as HTMLElement;
    const columnaMultimedia = () =>
      screen.getByTestId("multimedia").parentElement as HTMLElement;

    expect(columnaMapa().style.width).toBe("66.666%");
    expect(columnaMultimedia()).not.toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "abrir lugares" }));
    // the multimedia manager folds away and the map takes it all
    expect(columnaMapa().style.width).toBe("100%");
    expect(columnaMapa().style.marginRight).toBe("0px");
    expect(columnaMultimedia().style.width).toBe("0px");
    expect(columnaMultimedia()).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "cerrar lugares" }));
    expect(columnaMapa().style.width).toBe("66.666%");
    expect(columnaMultimedia()).not.toHaveAttribute("inert");
  });
});
