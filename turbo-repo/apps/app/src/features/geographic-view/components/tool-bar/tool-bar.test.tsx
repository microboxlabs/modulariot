import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import ToolBar from "./tool-bar";

vi.mock("flowbite-react", () => ({
  Tooltip: ({
    content,
    children,
    className,
  }: {
    content: string;
    children: ReactNode;
    className?: string;
  }) => (
    <>
      <div data-tooltip={content} className={className} />
      {children}
    </>
  ),
}));
vi.mock("./screenshot", () => ({ default: () => null }));
vi.mock("./map-selector", () => ({ default: () => null }));
vi.mock("@/features/symptoms/components/map-view/timeline", () => ({
  default: () => null,
}));

const dict: I18nRecord = {
  symptoms: {
    geofences: "Geocercas",
    geofencesMode: {
      all: "Todas las geocercas",
      trip: "Solo geocercas del viaje",
      none: "Sin geocercas",
    },
  },
};

describe("ToolBar geofences panel", () => {
  it("hides the hover tooltip while its panel is open", () => {
    render(
      <ToolBar
        positions={[]}
        display_position={{ displayPosition: 0, setDisplayPosition: vi.fn() }}
        geofences_mode={{ geofencesMode: "trip", setGeofencesMode: vi.fn() }}
        allow_screenshot={false}
        dictionary={dict}
      />
    );
    const panel = document.querySelector("[data-geofences-panel]");
    const tooltip = () => document.querySelector('[data-tooltip="Geocercas"]');
    const button = () =>
      document.querySelector("[data-geofences-button]") as HTMLElement;
    expect(panel).toHaveClass("hidden");

    fireEvent.click(button());
    expect(panel).not.toHaveClass("hidden");
    expect(tooltip()).toHaveClass("hidden");
    expect(
      screen.getByRole("radio", { name: "Solo geocercas del viaje" })
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(button());
    expect(panel).toHaveClass("hidden");
    expect(tooltip()).not.toHaveClass("hidden");
  });
});

it.each(["{Enter}", " "])(
  "opens geofence choices with the keyboard (%s)",
  async (key) => {
    render(
      <ToolBar
        positions={[]}
        display_position={{ displayPosition: 0, setDisplayPosition: vi.fn() }}
        geofences_mode={{ geofencesMode: "trip", setGeofencesMode: vi.fn() }}
        allow_screenshot={false}
        dictionary={dict}
      />
    );
    const button = screen.getByRole("button", { name: "Geocercas" });
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.setup().keyboard(key);
    expect(button).toHaveFocus();
    expect(document.querySelector("[data-geofences-panel]")).not.toHaveClass(
      "hidden"
    );
  }
);
