import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import PlacesToggle from "./places-toggle";

const dict = {
  geographic_view: {
    notch: { label: "Map views", places: "Places of interest" },
  },
} as unknown as I18nRecord;

describe("PlacesToggle", () => {
  it("works outside the geographic view and toggles Lugares", () => {
    // no GeographicProfileProvider: the trip map keeps its own state
    const onCambiar = vi.fn();
    const { rerender } = render(
      <PlacesToggle dict={dict} abierto={false} onCambiar={onCambiar} />
    );
    const boton = screen.getByRole("button", { name: "Places of interest" });
    expect(boton).toHaveAttribute("aria-pressed", "false");
    expect(boton.querySelector("[data-notch-close]")).toHaveAttribute(
      "data-notch-close",
      "hidden"
    );
    fireEvent.click(boton);
    expect(onCambiar).toHaveBeenCalledWith(true);

    // open: the pin turns into an X that closes it
    rerender(<PlacesToggle dict={dict} abierto onCambiar={onCambiar} />);
    const abierto = screen.getByRole("button", { name: "Places of interest" });
    expect(abierto).toHaveAttribute("aria-pressed", "true");
    expect(abierto.querySelector("[data-notch-close]")).toHaveAttribute(
      "data-notch-close",
      "shown"
    );
    fireEvent.click(abierto);
    expect(onCambiar).toHaveBeenLastCalledWith(false);
  });
});
