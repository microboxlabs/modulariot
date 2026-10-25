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
  it("draws an email with its subject and body, and warns when the channel has no version", () => {
    render(
      <TemplatePreview template={ALERT} channel="email" meta={[]} d={d} />
    );
    expect(screen.getByText("Revisa el viaje.")).toBeTruthy();
    expect(screen.getByText("OT-0001")).toBeTruthy();
    expect(
      screen.queryByText(
        "Esta plantilla no tiene versión para el canal del paso."
      )
    ).toBeNull();
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
  it("filters the list while typing and picks a template", async () => {
    const onChange = vi.fn();
    render(
      <TemplatePicker
        value=""
        templates={[ALERT, PANIC]}
        channel="email"
        meta={[]}
        emptyLabel="Elegir plantilla"
        invalid={false}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    await userEvent.type(screen.getByLabelText("Plantilla"), "pánico");
    expect(screen.queryByRole("option", { name: /Viaje · alerta/ })).toBeNull();
    await userEvent.click(
      screen.getByRole("option", { name: /Pánico · chequeo/ })
    );
    expect(onChange).toHaveBeenCalledWith("panic-check");
  });
});
