import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { FORM_VACIO, type PlacesWorkspace } from "@/features/places";
import PlacesFloatingOverlay from "./places-floating-overlay";

vi.mock("@/features/places/catalog/places-catalog", () => ({
  PlacesCatalogLists: () => <div>lugares-de-interes</div>,
  PlacesImportCard: () => <div>importar-lugares</div>,
}));

vi.mock("@/features/places/map/places-editor-overlays", () => ({
  PlacesEditorOverlays: () => null,
  PlacesStackedFormCards: () => <div>formulario-lugar</div>,
}));

const dict = {
  geographic_view: {
    places: { title: "Places of interest", hint: "Hint" },
  },
} as unknown as I18nRecord;

function ws(over: Partial<PlacesWorkspace>): PlacesWorkspace {
  return {
    modo: "ver",
    form: { ...FORM_VACIO },
    msg: null,
    ...over,
  } as PlacesWorkspace;
}

describe("PlacesFloatingOverlay", () => {
  it("hides the catalog while creating a trayecto and keeps the form", () => {
    render(
      <PlacesFloatingOverlay dict={dict} show ws={ws({ modo: "trayecto" })} />
    );
    expect(screen.getByText("formulario-lugar")).toBeInTheDocument();
    expect(screen.queryByText("lugares-de-interes")).toBeNull();
    expect(screen.queryByText("Places of interest")).toBeNull();
  });

  it("hides the catalog while creating a place and keeps the form", () => {
    render(
      <PlacesFloatingOverlay
        dict={dict}
        show
        ws={ws({ modo: "lugar", form: { ...FORM_VACIO, place_id: null } })}
      />
    );
    expect(screen.getByText("formulario-lugar")).toBeInTheDocument();
    expect(screen.queryByText("lugares-de-interes")).toBeNull();
    expect(screen.queryByText("Places of interest")).toBeNull();
  });

  it("shows the catalog on the normal places view", () => {
    render(<PlacesFloatingOverlay dict={dict} show ws={ws({ modo: "ver" })} />);
    expect(screen.getByText("lugares-de-interes")).toBeInTheDocument();
    expect(screen.getByText("Places of interest")).toBeInTheDocument();
  });

  it("turns the catalog into the import drop zone", () => {
    render(
      <PlacesFloatingOverlay
        dict={dict}
        show
        ws={ws({ modo: "import", abrirImport: vi.fn() })}
      />
    );
    expect(screen.getByText("importar-lugares")).toBeInTheDocument();
    expect(screen.queryByText("lugares-de-interes")).toBeNull();
    expect(screen.queryByText("Places of interest")).toBeNull();
  });

  it("hides the catalog while editing a place", () => {
    render(
      <PlacesFloatingOverlay
        dict={dict}
        show
        ws={ws({
          modo: "lugar",
          form: { ...FORM_VACIO, place_id: "p1", name: "Planta" },
        })}
      />
    );
    expect(screen.getByText("formulario-lugar")).toBeInTheDocument();
    expect(screen.queryByText("lugares-de-interes")).toBeNull();
  });

  it("hides the catalog on the inner geofence list", () => {
    render(
      <PlacesFloatingOverlay
        dict={dict}
        show
        ws={ws({
          modo: "lugar",
          pasoLugar: "interiores",
          form: { ...FORM_VACIO, place_id: "p1", name: "Planta" },
        })}
      />
    );
    expect(screen.getByText("formulario-lugar")).toBeInTheDocument();
    expect(screen.queryByText("lugares-de-interes")).toBeNull();
  });
});
