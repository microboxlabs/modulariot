import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

const permisos = vi.hoisted(() => ({ lista: [] as string[] }));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useMyAccess: () => ({
    access: undefined,
    accessError: undefined,
    can: (p: string) => permisos.lista.includes(p),
  }),
}));

const dict = {
  geographic_view: {
    places_permission_debug: {
      title: "Debug · Editor de lugares",
      hint: "Solo en este navegador.",
      real: "Según roles",
      on: "Forzar activo",
      off: "Forzar inactivo",
      granted: "Tus roles lo tienen",
      denied: "Tus roles no lo tienen",
      active: "Activo",
      inactive: "Inactivo",
    },
  },
} as unknown as I18nRecord;

/**
 * The flag is read once when the module loads: set the variable, then load
 * the modules fresh. Renders the card (only if the flag is on, as the map
 * does) plus a probe of what the page lets the user open.
 */
async function renderDebug(variable: "true" | "false" = "true") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DEBUG_PLACES_PERMISSION", variable);
  const permiso = await import("../profiles/places-permission");
  const { GeographicProfileProvider, useGeographicProfile } =
    await import("../profiles/geographic-profile-context");
  const { default: PlacesPermissionDebug } =
    await import("./places-permission-debug");
  function Sonda() {
    const { activeView, setActiveView } = useGeographicProfile();
    // con permiso se edita; sin él, Lugares es de solo lectura
    const editable = permiso.usePermisoEditorLugares();
    return (
      <>
        <span data-testid="lugares">{editable ? "si" : "no"}</span>
        <span data-testid="vista">{activeView ?? "ninguna"}</span>
        <button type="button" onClick={() => setActiveView("places")}>
          abrir lugares
        </button>
      </>
    );
  }
  render(
    <GeographicProfileProvider>
      {permiso.DEBUG_PERMISO_LUGARES && <PlacesPermissionDebug dict={dict} />}
      <Sonda />
    </GeographicProfileProvider>
  );
  return permiso;
}

describe("places permission debug", () => {
  beforeEach(() => {
    permisos.lista = [];
    globalThis.localStorage.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("stays off and ignores a saved override without the variable", async () => {
    globalThis.localStorage.setItem(
      "miot.debug.places-permission.v1",
      "activo"
    );
    const { DEBUG_PERMISO_LUGARES, permisoEfectivo } =
      await renderDebug("false");
    expect(DEBUG_PERMISO_LUGARES).toBe(false);
    expect(
      screen.queryByRole("region", { name: "Debug · Editor de lugares" })
    ).toBeNull();
    // only the real permission counts: no roles, no Lugares
    expect(screen.getByTestId("lugares")).toHaveTextContent("no");
    expect(permisoEfectivo(false, "activo")).toBe(false);
  });

  it("forces the permission over the user's roles", async () => {
    const { permisoEfectivo } = await renderDebug();
    expect(permisoEfectivo(false, "real")).toBe(false);
    expect(permisoEfectivo(true, "real")).toBe(true);
    expect(permisoEfectivo(false, "activo")).toBe(true);
    expect(permisoEfectivo(true, "inactivo")).toBe(false);
  });

  it("starts from the roles and opens Lugares when forced on", async () => {
    await renderDebug();
    expect(
      screen.getByText("Tus roles no lo tienen", { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.getByTestId("lugares")).toHaveTextContent("no");

    fireEvent.click(screen.getByRole("radio", { name: "Forzar activo" }));
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByTestId("lugares")).toHaveTextContent("si");
    fireEvent.click(screen.getByRole("button", { name: "abrir lugares" }));
    expect(screen.getByTestId("vista")).toHaveTextContent("places");
    // the choice is kept for the next visit
    expect(
      globalThis.localStorage.getItem("miot.debug.places-permission.v1")
    ).toBe("activo");
  });

  it("keeps Lugares open, read-only, when the permission is forced off", async () => {
    permisos.lista = ["controltower:places.edit"];
    await renderDebug();
    fireEvent.click(screen.getByRole("button", { name: "abrir lugares" }));
    expect(screen.getByTestId("lugares")).toHaveTextContent("si");
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Forzar inactivo" }));
    });
    // still open: only editing goes away
    expect(screen.getByTestId("vista")).toHaveTextContent("places");
    expect(screen.getByTestId("lugares")).toHaveTextContent("no");
  });
});
