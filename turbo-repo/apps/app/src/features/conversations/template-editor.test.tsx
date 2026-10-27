import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationTemplate, MetaTemplate } from "./conversations-types";

const stored: ConversationTemplate = {
  id: "t1",
  key: "new",
  name: "New",
  baseText: "Hola",
  whatsapp: null,
  email: null,
};

const META: MetaTemplate = {
  id: "901",
  name: "panic_check",
  language: "es_CL",
  category: "UTILITY",
  status: "PENDING",
  rejectedReason: null,
  parameterFormat: "NAMED",
  headerFormat: null,
  header: null,
  body: "Hola {{nombre}}, ¿estás bien?",
  footer: null,
  buttons: [],
  params: ["nombre"],
  examples: { nombre: "Juan" },
};

const APPROVED: MetaTemplate = {
  ...META,
  id: "902",
  name: "trip_reminder",
  status: "APPROVED",
  params: ["patente", "hora"],
};

const TEMPLATE: ConversationTemplate = {
  id: "t1",
  key: "panic-check",
  name: "Pánico: ¿estás bien?",
  baseText: "Hola {{nombre}}",
  whatsapp: { metaName: "panic_check", language: "es_CL", params: [] },
  email: null,
  usedBy: [],
};

const api = vi.hoisted(() => ({
  refreshTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  useConversationTemplates: vi.fn(),
  useMetaTemplates: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import { TemplateEditor } from "./template-editor";

const d = es.pages.userSettings.communications;

describe("TemplateEditor for a new template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.useMetaTemplates.mockReturnValue({ data: undefined });
  });

  it("does not let a new template take the key of a stored one", () => {
    render(
      <TemplateEditor
        template={null}
        readOnly={false}
        takenKeys={[stored.key]}
        lang="es"
        d={d}
        onSaved={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "New" },
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "Otra plantilla ya usa esta clave. Elige otro nombre."
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Guardar plantilla",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(api.saveTemplate).not.toHaveBeenCalled();
  });
});

const editor = () =>
  render(
    <TemplateEditor
      template={TEMPLATE}
      readOnly={false}
      lang="es"
      d={d}
      onSaved={vi.fn()}
    />
  );

describe("TemplateEditor with the WABA's templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.useMetaTemplates.mockReturnValue({ data: [META, APPROVED] });
  });

  it("shows the picked template's status and warns when Meta has not approved it", () => {
    editor();
    expect(screen.getByText("En revisión")).toBeTruthy();
    expect(screen.getByText(d.metaNotApproved)).toBeTruthy();
    expect(
      screen.getByText("Los parámetros no son los de Meta: nombre.")
    ).toBeTruthy();
  });

  it("picks a template from a searchable list and takes its language and parameters", async () => {
    editor();
    const input = screen.getByRole("combobox", { name: "Plantilla de Meta" });
    await userEvent.clear(input);
    await userEvent.type(input, "trip");
    expect(screen.queryByRole("option", { name: /panic_check/ })).toBeNull();
    await userEvent.click(
      screen.getByRole("option", { name: /trip_reminder/ })
    );

    expect((input as HTMLInputElement).value).toBe("trip_reminder");
    expect(screen.getByText("1. patente")).toBeTruthy();
    expect(screen.getByText("2. hora")).toBeTruthy();
    expect(screen.queryByText(d.metaNotApproved)).toBeNull();
  });

  it("keeps a typed name that is not on Meta and says so", async () => {
    editor();
    const input = screen.getByRole("combobox", { name: "Plantilla de Meta" });
    await userEvent.clear(input);
    await userEvent.type(input, "new_one");
    await userEvent.click(
      screen.getByRole("option", { name: "Usar «new_one»" })
    );
    expect(
      screen.getByText("new_one no está en la cuenta de WhatsApp.")
    ).toBeTruthy();
  });

  it("warns that a header with parameters or numbered parameters cannot be sent", () => {
    api.useMetaTemplates.mockReturnValue({
      data: [
        {
          ...META,
          parameterFormat: "POSITIONAL",
          header: "Alerta {{patente}}",
          headerFormat: "TEXT",
        },
      ],
    });
    editor();
    expect(
      screen.getByText(
        "Su encabezado tiene parámetros (patente) y las reglas solo llenan los del cuerpo, así que los envíos fallarán."
      )
    ).toBeTruthy();
    expect(screen.getByText(d.metaPositional)).toBeTruthy();
  });

  it("falls back to a text field without the WABA's list", () => {
    api.useMetaTemplates.mockReturnValue({ data: undefined });
    editor();
    expect(
      (screen.getByLabelText("Plantilla de Meta") as HTMLInputElement).value
    ).toBe("panic_check");
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
