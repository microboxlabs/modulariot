import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { GeographicProfileProvider } from "../../profiles/geographic-profile-context";
import MapNotch from "./map-notch";

// the signed-in user's permissions; the places editor needs "Editor de lugares"
const permisos = vi.hoisted(() => ({ lista: ["controltower:places.edit"] }));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useMyAccess: () => ({
    access: undefined,
    accessError: undefined,
    can: (p: string) => permisos.lista.includes(p),
  }),
}));

const dict = {
  geographic_view: {
    notch: {
      label: "Map views",
      places: "Places of interest",
    },
  },
} as unknown as I18nRecord;

function renderNotch(alSalirDeLugares?: (seguir: () => void) => void) {
  return render(
    <GeographicProfileProvider>
      <MapNotch dict={dict} alSalirDeLugares={alSalirDeLugares} />
    </GeographicProfileProvider>
  );
}

describe("MapNotch", () => {
  beforeEach(() => {
    permisos.lista = ["controltower:places.edit"];
    globalThis.localStorage.clear();
  });

  it("shows Lugares even without the Editor de lugares permission", () => {
    // without it Lugares opens read-only (the editor decides), not hidden
    permisos.lista = [];
    renderNotch();
    const places = screen.getByRole("button", { name: "Places of interest" });
    fireEvent.click(places);
    expect(places).toHaveAttribute("aria-pressed", "true");
  });

  it("only offers Lugares de interés and toggles it off on a second click", () => {
    renderNotch();
    const places = screen.getByRole("button", { name: "Places of interest" });

    const icono = () => places.querySelector("[data-notch-icon]");
    const cerrar = () => places.querySelector("[data-notch-close]");
    expect(places).toHaveAttribute("aria-pressed", "false");
    expect(icono()).toHaveAttribute("data-notch-icon", "shown");
    expect(cerrar()).toHaveAttribute("data-notch-close", "hidden");

    // open: its icon turns into an X that closes it
    fireEvent.click(places);
    expect(places).toHaveAttribute("aria-pressed", "true");
    expect(icono()).toHaveAttribute("data-notch-icon", "hidden");
    expect(cerrar()).toHaveAttribute("data-notch-close", "shown");
    expect(cerrar()).toHaveClass("transition-[opacity,transform]");

    fireEvent.click(places);
    expect(places).toHaveAttribute("aria-pressed", "false");
    expect(icono()).toHaveAttribute("data-notch-icon", "shown");
  });

  it("asks before leaving Lugares and only closes it if the user leaves", () => {
    let seguir: (() => void) | null = null;
    const alSalir = vi.fn((s: () => void) => {
      seguir = s; // e.g. the unsaved-changes modal is open
    });
    renderNotch(alSalir);
    const places = screen.getByRole("button", { name: "Places of interest" });
    fireEvent.click(places);
    // opening does not ask
    expect(alSalir).not.toHaveBeenCalled();

    fireEvent.click(places);
    expect(alSalir).toHaveBeenCalledTimes(1);
    expect(places).toHaveAttribute("aria-pressed", "true");
    // "Salir sin guardar"
    act(() => seguir?.());
    expect(places).toHaveAttribute("aria-pressed", "false");
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
