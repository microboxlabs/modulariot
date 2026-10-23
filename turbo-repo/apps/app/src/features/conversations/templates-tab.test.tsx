import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationTemplate } from "./conversations-types";

const stored: ConversationTemplate = {
  id: "t1",
  key: "new",
  name: "New",
  baseText: "Hola",
  whatsapp: null,
  email: null,
};
const api = vi.hoisted(() => ({
  refreshTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  useConversationTemplates: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import TemplatesTab from "./templates-tab";

const d = es.pages.userSettings.communications;

describe("TemplatesTab", () => {
  it("opens a stored template whose key is 'new' as that template", () => {
    api.useConversationTemplates.mockReturnValue({ data: [stored] });
    render(<TemplatesTab lang="es" canWrite d={d} />);

    fireEvent.click(screen.getByRole("button", { name: /^New/ }));

    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe(
      "New"
    );
  });

  it("does not let a new template take the key of a stored one", () => {
    api.useConversationTemplates.mockReturnValue({ data: [stored] });
    render(<TemplatesTab lang="es" canWrite d={d} />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva plantilla" }));
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
