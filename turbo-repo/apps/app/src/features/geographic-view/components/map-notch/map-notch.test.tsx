import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { GeographicProfileProvider } from "../../profiles/geographic-profile-context";
import MapNotch from "./map-notch";

const dict = {
  geographic_view: {
    notch: {
      label: "Map views",
      places: "Places of interest",
      test: "Test view",
    },
  },
} as unknown as I18nRecord;

function renderNotch() {
  return render(
    <GeographicProfileProvider>
      <MapNotch dict={dict} />
    </GeographicProfileProvider>
  );
}

describe("MapNotch", () => {
  it("selects a view and toggles it off on a second click", () => {
    renderNotch();
    const places = screen.getByRole("button", { name: "Places of interest" });
    const test = screen.getByRole("button", { name: "Test view" });

    expect(places).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(places);
    expect(places).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(test);
    expect(test).toHaveAttribute("aria-pressed", "true");
    expect(places).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(test);
    expect(test).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a floating section name on hover and hides it when idle", () => {
    renderNotch();
    const places = screen.getByRole("button", { name: "Places of interest" });
    const item = places.parentElement;
    const flyout = item?.querySelector("[data-notch-label]");

    expect(flyout).toHaveAttribute("data-notch-label", "closed");
    fireEvent.mouseEnter(item!);
    expect(flyout).toHaveAttribute("data-notch-label", "open");
    fireEvent.mouseLeave(item!);
    expect(flyout).toHaveAttribute("data-notch-label", "closed");
  });
});
