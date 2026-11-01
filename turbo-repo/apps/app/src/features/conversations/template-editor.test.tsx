import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type {
  ConversationTemplate,
  EventTypeInfo,
  MetaTemplate,
} from "./conversations-types";

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
  version: "0.1.0",
  usedBy: [
    {
      id: "r1",
      key: "panic",
      name: "Pánico",
      state: "ACTIVE",
      event: "symptom.opened",
    },
  ],
};

const CATALOG: EventTypeInfo[] = [
  {
    type: "symptom.opened",
    source: "symptoms",
    description: "Se abrió un caso",
    fields: [{ name: "assetId", label: "Vehículo", type: "string" }],
    variables: [
      { name: "nombre", label: "Nombre", type: "string" },
      { name: "patente", label: "Patente", type: "string" },
      { name: "hora", label: "Hora", type: "string" },
    ],
  },
];

const api = vi.hoisted(() => ({
  createMetaTemplate: vi.fn(),
  editMetaTemplate: vi.fn(),
  previewTemplateEmail: vi.fn(),
  refreshMetaTemplates: vi.fn(),
  refreshTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  useEventCatalog: vi.fn(),
  useMetaTemplates: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import { TemplateEditor } from "./template-editor";

const d = es.pages.userSettings.communications;

const editor = (template: ConversationTemplate | null = TEMPLATE) =>
  render(
    <TemplateEditor
      template={template}
      readOnly={false}
      takenKeys={[stored.key]}
      lang="es"
      d={d}
      backHref="/es/back"
      onSaved={vi.fn()}
    />
  );

const messageText = () =>
  screen.getByLabelText(d.tplText) as HTMLTextAreaElement;

beforeEach(() => {
  vi.clearAllMocks();
  api.useEventCatalog.mockReturnValue({ data: CATALOG });
  api.useMetaTemplates.mockReturnValue({ data: undefined });
});

describe("TemplateEditor for a new template", () => {
  it("does not let a new template take the key of a stored one", () => {
    editor(null);
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "New" },
    });

    expect(screen.getByRole("alert").textContent).toBe(d.templateKeyTaken);
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

describe("TemplateEditor's message", () => {
  it("offers the variables of the event its rules listen to and inserts one at the cursor", async () => {
    editor();
    expect((screen.getByLabelText(d.tplEvent) as HTMLSelectElement).value).toBe(
      "symptom.opened"
    );
    const text = messageText();
    text.focus();
    text.setSelectionRange(4, 4);
    fireEvent.click(screen.getByRole("button", { name: /\{\{patente\}\}/ }));
    await waitFor(() =>
      expect(messageText().value).toBe("Hola{{patente}} {{nombre}}")
    );
  });

  it("wraps the selection in WhatsApp's bold mark and previews it bold", async () => {
    editor();
    const text = messageText();
    text.focus();
    text.setSelectionRange(0, 4);
    fireEvent.click(screen.getByRole("button", { name: d.fmtBold }));
    await waitFor(() => expect(messageText().value).toBe("*Hola* {{nombre}}"));
    const preview = screen.getByRole("figure", {
      name: d.previewWhatsappLabel,
    });
    expect(preview.querySelector("strong")?.textContent).toBe("Hola");
    expect(preview.textContent).toContain("Juan Soto");
  });

  it("warns about variables the event does not give", () => {
    editor();
    fireEvent.change(messageText(), {
      target: { value: "Hola {{nombre}} {{nada}}" },
    });
    expect(
      screen.getByText("El evento no entrega nada: se enviarán vacías.")
    ).toBeTruthy();
  });

  it("saves the text's variables as the WhatsApp parameters when Meta does not have it", async () => {
    api.saveTemplate.mockResolvedValue(TEMPLATE);
    editor();
    fireEvent.change(messageText(), {
      target: { value: "Hola {{nombre}}, {{patente}}" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));
    await waitFor(() => expect(api.saveTemplate).toHaveBeenCalled());
    expect(api.saveTemplate.mock.calls[0][1].whatsapp.params).toEqual([
      "nombre",
      "patente",
    ]);
  });
});

describe("TemplateEditor's email and chats", () => {
  it("turns a plain-text email into HTML and previews it as the backend writes it", async () => {
    api.previewTemplateEmail.mockResolvedValue({
      subject: "Pánico TEST01",
      html: "<!DOCTYPE html><p>layout</p>",
      text: "layout",
    });
    editor({
      ...TEMPLATE,
      email: { subject: "Pánico {{patente}}", body: "Hola & <chao>\n\nAdiós" },
    });
    const html = screen.getByLabelText(d.tplEmailHtml) as HTMLTextAreaElement;
    expect(html.value).toBe("<p>Hola &amp; &lt;chao&gt;</p>\n<p>Adiós</p>");
    expect(
      screen.queryByRole("button", { name: "Guardar plantilla" })
    ).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("tab", { name: /Correo/ }));
    await waitFor(
      () =>
        expect(api.previewTemplateEmail).toHaveBeenCalledWith(
          "Pánico {{patente}}",
          "<p>Hola &amp; &lt;chao&gt;</p>\n<p>Adiós</p>",
          expect.objectContaining({ patente: "TEST01" })
        ),
      { timeout: 2000 }
    );
    expect(await screen.findByTitle(d.previewEmailLabel)).toBeTruthy();
  });

  it("asks chats for their own text only without WhatsApp", () => {
    editor();
    expect(screen.getByText(d.tplChatsUseWhatsapp)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("switch", { name: /Activo/, checked: true })
    );
    expect(
      (screen.getByLabelText(d.tplChatText) as HTMLTextAreaElement).value
    ).toBe("Hola {{nombre}}");
  });
});

describe("TemplateEditor with the WABA's templates", () => {
  beforeEach(() => {
    api.useMetaTemplates.mockReturnValue({ data: [META, APPROVED] });
  });

  it("shows the picked template's status on Meta", () => {
    editor();
    expect(screen.getByText("En revisión")).toBeTruthy();
    expect(screen.getAllByText(d.tplMetaPending).length).toBeGreaterThan(0);
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
    expect(screen.getByText("{{patente}} {{hora}}")).toBeTruthy();
  });

  it("keeps a typed name that is not on Meta and offers to submit it", async () => {
    editor();
    const input = screen.getByRole("combobox", { name: "Plantilla de Meta" });
    await userEvent.clear(input);
    await userEvent.type(input, "new_one");
    await userEvent.click(
      screen.getByRole("option", { name: "Usar «new_one»" })
    );
    expect(
      screen.getByText(/^new_one aún no está en la cuenta de WhatsApp\. Envía/)
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Enviar a revisión de Meta" })
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
});

describe("TemplateEditor without the WABA's list", () => {
  it("falls back to a text field", () => {
    editor();
    expect(
      (screen.getByLabelText("Plantilla de Meta") as HTMLInputElement).value
    ).toBe("panic_check");
    expect(
      screen.queryByRole("combobox", { name: "Plantilla de Meta" })
    ).toBeNull();
    expect(screen.getByText(d.tplMetaUnreadable)).toBeTruthy();
  });
});
