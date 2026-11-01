import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationTemplate } from "./conversations-types";
import TemplatePicker, {
  matchStepTemplates,
  TemplatePreview,
  templateFits,
} from "./template-picker";

const d = es.pages.userSettings.communications;

const list = vi.hoisted(() => ({ error: undefined as Error | undefined }));
vi.mock("./conversations-api", () => ({
  useConversationTemplates: () => ({ data: undefined, error: list.error }),
}));

const template = (
  key: string,
  name: string,
  extra: Partial<ConversationTemplate> = {}
): ConversationTemplate => ({
  id: key,
  key,
  name,
  baseText: "",
  whatsapp: null,
  email: null,
  ...extra,
});

const ALERT = template("trip-alert", "Viaje · alerta", {
  baseText: "Alerta en el viaje {{orderRef}}",
  email: { subject: "Alerta {{orderRef}}", body: "Revisa el viaje." },
});
const PANIC = template("panic-check", "Pánico · chequeo", {
  baseText: "¿Estás bien?",
  whatsapp: { metaName: "panic_check", language: "es", params: [] },
});

describe("matchStepTemplates", () => {
  it("finds templates by every word of the query in name, key or text, ignoring accents", () => {
    const list = [ALERT, PANIC];
    expect(matchStepTemplates(list, "")).toEqual(list);
    expect(matchStepTemplates(list, "panico").map((t) => t.key)).toEqual([
      "panic-check",
    ]);
    expect(
      matchStepTemplates(list, "viaje orderref").map((t) => t.key)
    ).toEqual(["trip-alert"]);
    expect(matchStepTemplates(list, "nada")).toEqual([]);
  });
});

describe("templateFits", () => {
  it("asks for the channel's version, both for the preferred one", () => {
    expect(templateFits(ALERT, "email")).toBe(true);
    expect(templateFits(ALERT, "whatsapp")).toBe(false);
    expect(templateFits(PANIC, "preferred")).toBe(false);
    expect(templateFits(PANIC, "slack")).toBe(true);
  });
});

describe("TemplatePreview", () => {
  it("draws an email with its subject and body, with sample values", () => {
    render(
      <TemplatePreview template={ALERT} channel="email" meta={[]} d={d} />
    );
    expect(screen.getByText("Revisa el viaje.")).toBeTruthy();
    expect(screen.getByText("OT-0001")).toBeTruthy();
  });

  it("previews the email body that a connection sends when an email variant exists", () => {
    render(
      <TemplatePreview template={ALERT} channel="slack" meta={[]} d={d} />
    );
    expect(screen.getByText("Revisa el viaje.")).toBeTruthy();
    expect(screen.queryByText(/Alerta en el viaje/)).toBeNull();
  });

  it.each(["slack", "teams", "webhook"])(
    "previews the short text before HTML for %s",
    (channel) => {
      render(
        <TemplatePreview
          template={{
            ...ALERT,
            baseText: "Short message",
            email: { subject: "Quota", body: null, html: "<p>Full email</p>" },
          }}
          channel={channel}
          meta={[]}
          d={d}
        />
      );
      expect(screen.getByText("Short message")).toBeTruthy();
      expect(screen.queryByText("Full email")).toBeNull();
    }
  );

  it("keeps the HTML body for an email channel", () => {
    render(
      <TemplatePreview
        template={{
          ...ALERT,
          baseText: "Short message",
          email: { subject: "Quota", body: null, html: "<p>Full email</p>" },
        }}
        channel="email"
        meta={[]}
        d={d}
      />
    );
    expect(screen.getByText("Full email")).toBeTruthy();
    expect(screen.queryByText("Short message")).toBeNull();
  });

  it("says the message is not sent on a channel the template has no version for", () => {
    render(
      <TemplatePreview template={ALERT} channel="whatsapp" meta={[]} d={d} />
    );
    expect(screen.getByText(/No se envía por WhatsApp/)).toBeTruthy();
    expect(screen.queryByText(/Alerta en el viaje/)).toBeNull();
  });

  it("shows the base text in a bubble when the Meta template is not in the account", () => {
    render(
      <TemplatePreview template={PANIC} channel="whatsapp" meta={[]} d={d} />
    );
    expect(screen.getByText("¿Estás bien?")).toBeTruthy();
    expect(screen.getByText(/panic_check no está en la cuenta/)).toBeTruthy();
  });
});

describe("TemplatePicker", () => {
  it("lists only the templates the channel can send, filters them while typing and picks one", async () => {
    const onChange = vi.fn();
    render(
      <TemplatePicker
        value=""
        templates={[ALERT, PANIC]}
        channel="whatsapp"
        meta={[]}
        emptyLabel="Elegir plantilla"
        invalid={false}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByLabelText("Plantilla"));
    expect(screen.queryByRole("option", { name: /Viaje · alerta/ })).toBeNull();
    await userEvent.type(screen.getByLabelText("Plantilla"), "pánico");
    await userEvent.click(
      screen.getByRole("option", { name: /Pánico · chequeo/ })
    );
    expect(onChange).toHaveBeenCalledWith("panic-check");
  });

  it("says the templates did not load instead of saying none fits the channel", async () => {
    list.error = new Error("HTTP 502");
    render(
      <TemplatePicker
        value=""
        templates={[]}
        channel="email"
        meta={[]}
        emptyLabel="Elegir plantilla"
        invalid={false}
        readOnly={false}
        d={d}
        onChange={() => undefined}
      />
    );
    await userEvent.click(screen.getByLabelText("Plantilla"));
    expect(
      screen.getAllByText(
        "No se pudieron cargar las plantillas. Recarga la página en un momento."
      )
    ).toHaveLength(2);
    expect(screen.queryByText("Ninguna plantilla coincide.")).toBeNull();
    expect(screen.queryByText(/Ninguna plantilla tiene versión/)).toBeNull();
    list.error = undefined;
  });
});
