import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { MetaTemplate } from "./conversations-types";

const APPROVED: MetaTemplate = {
  id: "901",
  name: "panic_check",
  language: "es_CL",
  category: "UTILITY",
  status: "APPROVED",
  rejectedReason: null,
  parameterFormat: "NAMED",
  headerFormat: null,
  header: null,
  body: "Hola {{nombre}}, ¿estás bien?",
  footer: null,
  buttons: [{ type: "QUICK_REPLY", text: "Estoy bien" }],
  params: ["nombre"],
  examples: { nombre: "Juan" },
};

const REJECTED: MetaTemplate = {
  ...APPROVED,
  id: "902",
  name: "trip_reminder",
  status: "REJECTED",
  rejectedReason: "INVALID_FORMAT",
};

const api = vi.hoisted(() => ({
  useMetaTemplates: vi.fn(),
  createMetaTemplate: vi.fn(),
  editMetaTemplate: vi.fn(),
  deleteMetaTemplate: vi.fn(),
  refreshMetaTemplates: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import MetaTemplatesSection from "./meta-templates-section";

const d = es.pages.userSettings.communications;

describe("MetaTemplatesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.useMetaTemplates.mockReturnValue({
      data: [APPROVED, REJECTED],
      isLoading: false,
      isValidating: false,
    });
  });

  it("lists the templates with their status and the rejection reason", () => {
    render(<MetaTemplatesSection canWrite d={d} />);
    const list = screen.getByRole("navigation", {
      name: "Plantillas de WhatsApp en Meta",
    });
    expect(within(list).getByText("Aprobada")).toBeTruthy();
    expect(within(list).getByText("Rechazada")).toBeTruthy();
    expect(within(list).getByText("INVALID_FORMAT")).toBeTruthy();

    fireEvent.click(within(list).getByText("trip_reminder"));
    expect(screen.getByText("Meta la rechazó: INVALID_FORMAT")).toBeTruthy();
  });

  it("refreshes the statuses from Meta", () => {
    render(<MetaTemplatesSection canWrite d={d} />);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar estados" }));
    expect(api.refreshMetaTemplates).toHaveBeenCalled();
  });

  it("previews and submits a new template with an example per parameter", async () => {
    api.createMetaTemplate.mockResolvedValue({ ...APPROVED, id: "903" });
    render(<MetaTemplatesSection canWrite d={d} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Nueva plantilla de WhatsApp" })
    );

    const submit = screen.getByRole("button", { name: "Enviar a Meta" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Nombre en Meta"), {
      target: { value: "Trip Alert" },
    });
    fireEvent.change(screen.getByLabelText("Cuerpo"), {
      target: { value: "Hola {{nombre}}, el {{patente}} llegó." },
    });
    expect(screen.getByText("Falta el ejemplo de {{nombre}}.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ejemplo de nombre"), {
      target: { value: "Juan" },
    });
    fireEvent.change(screen.getByLabelText("Ejemplo de patente"), {
      target: { value: "TEST01" },
    });
    const preview = screen.getByRole("figure", {
      name: "Así se ve en WhatsApp",
    });
    expect(preview.textContent).toContain("Hola Juan, el TEST01 llegó.");

    fireEvent.click(screen.getByRole("button", { name: "Agregar botón" }));
    fireEvent.change(screen.getByLabelText("Texto del botón 1"), {
      target: { value: "Recibido" },
    });
    expect(preview.textContent).toContain("Recibido");

    fireEvent.click(submit);
    await waitFor(() => expect(api.createMetaTemplate).toHaveBeenCalled());
    expect(api.createMetaTemplate).toHaveBeenCalledWith({
      name: "trip_alert",
      language: "es_CL",
      category: "UTILITY",
      header: "",
      body: "Hola {{nombre}}, el {{patente}} llegó.",
      footer: "",
      buttons: [{ type: "QUICK_REPLY", text: "Recibido" }],
      examples: { nombre: "Juan", patente: "TEST01" },
    });
    expect(api.refreshMetaTemplates).toHaveBeenCalled();
  });

  it("shows Meta's refusal", async () => {
    api.editMetaTemplate.mockRejectedValue(
      new Error("Meta: Too many edits: Try again tomorrow.")
    );
    render(<MetaTemplatesSection canWrite d={d} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar y enviar a revisión" })
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Meta: Too many edits: Try again tomorrow."
    );
    expect(api.editMetaTemplate).toHaveBeenCalledWith(
      "901",
      expect.objectContaining({ name: "panic_check" })
    );
  });

  it("deletes after confirming", async () => {
    api.deleteMetaTemplate.mockResolvedValue(undefined);
    render(<MetaTemplatesSection canWrite d={d} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar plantilla" }));
    expect(api.deleteMetaTemplate).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Eliminar plantilla" })
    );
    await waitFor(() =>
      expect(api.deleteMetaTemplate).toHaveBeenCalledWith("panic_check", "901")
    );
  });

  it("does not edit a template under review nor offer writes to readers", () => {
    api.useMetaTemplates.mockReturnValue({
      data: [{ ...APPROVED, status: "PENDING" }],
      isLoading: false,
      isValidating: false,
    });
    render(<MetaTemplatesSection canWrite={false} d={d} />);
    expect(screen.getByText(d.metaLockedPending)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Eliminar plantilla" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Nueva plantilla de WhatsApp" })
    ).toBeNull();
    expect(
      (screen.getByLabelText("Cuerpo") as HTMLTextAreaElement).disabled
    ).toBe(true);
  });
});
