import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";

const api = vi.hoisted(() => ({
  createRule: vi.fn(),
  refreshRules: vi.fn(),
  useEventCatalog: vi.fn(() => ({ data: [] })),
}));
const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock("./conversations-api", () => api);
vi.mock("./use-symptom-names", () => ({
  useSymptomNames: () => (key: string) =>
    key === "panic-button" ? "Botón de pánico" : undefined,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.params,
}));

import NewRule, { newRuleHref } from "./new-rule";

const dict = es.pages.userSettings;
const WHEN = "event.data.symptomKey == 'panic-button' && event.data.level >= 4";

describe("NewRule", () => {
  it("creates the rule with the trigger from the link and opens its editor", async () => {
    const href = newRuleHref("es", {
      event: "symptom.case.opened",
      when: WHEN,
      name: "Botón de pánico · Código negro",
    });
    nav.params = new URL(href, "http://x").searchParams;
    api.createRule.mockResolvedValue({ rule: { id: "r9" } });

    render(<NewRule dict={dict} lang="es" />);
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe(
      "Botón de pánico · Código negro"
    );
    expect(
      screen.getByText(
        "Cuando se abre un caso de Botón de pánico en Código negro"
      )
    ).toBeTruthy();
    expect(screen.getByText("boton-de-panico-codigo-negro")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Crear regla" }));
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith(
        "/es/users/settings/communications/rules/r9"
      )
    );
    expect(api.createRule).toHaveBeenCalledWith({
      key: "boton-de-panico-codigo-negro",
      name: "Botón de pánico · Código negro",
      spec: {
        trigger: { event: "symptom.case.opened", when: WHEN },
        audience: [{ role: "driver" }],
        steps: [
          {
            after: 0,
            channel: "whatsapp",
            template: "",
            to: "audience",
            waitForReply: 5,
            onReply: "stop",
          },
        ],
      },
    });
  });

  it("needs a name before it creates anything", () => {
    nav.params = new URLSearchParams();
    render(<NewRule dict={dict} lang="es" />);
    expect(
      (screen.getByRole("button", { name: "Crear regla" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
