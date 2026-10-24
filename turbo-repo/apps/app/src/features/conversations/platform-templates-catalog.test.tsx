import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationTemplate } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConversationTemplates: vi.fn(),
  useMetaTemplates: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import MessageTemplatesPanel from "./platform-templates-catalog";

const d = es.pages.userSettings.communications;

const CHECK: ConversationTemplate = {
  id: "t1",
  key: "panic-check",
  name: "Pánico · conductor",
  baseText: "Hola {{nombre}}, ¿estás bien?",
  whatsapp: { metaName: "miot_panic_check_v1", language: "es_CL", params: [] },
  email: null,
  version: "0.2.1",
  usedBy: [
    {
      id: "r1",
      key: "panic",
      name: "Pánico",
      state: "ACTIVE",
      tenantCode: "org-a",
    },
  ],
};

const TOWER: ConversationTemplate = {
  id: "t2",
  key: "panic-tower",
  name: "Pánico · torre",
  baseText: "Sin respuesta",
  whatsapp: null,
  email: { subject: "Pánico", body: "Sin respuesta" },
  version: "0.1.0",
  usedBy: [],
};

describe("MessageTemplatesPanel", () => {
  beforeEach(() => {
    api.useConversationTemplates.mockReturnValue({ data: [CHECK, TOWER] });
  });

  it("in an organization lists the templates read-only, with the rules that use each", () => {
    const { container } = render(
      <MessageTemplatesPanel channel="" layout="list" lang="es" d={d} readOnly />
    );
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("Pánico · conductor")).toBeTruthy();
    expect(screen.getByText("Pánico")).toBeTruthy();
  });

  it("shows each template as a card that opens it in Comunicaciones", () => {
    render(<MessageTemplatesPanel channel="" layout="cards" lang="es" d={d} />);
    const card = screen
      .getByText("Pánico · conductor")
      .closest("a") as HTMLElement;
    expect(card.getAttribute("href")).toBe(
      "/es/users/settings/communications/templates/panic-check"
    );
    expect(within(card).getByText("panic-check")).toBeTruthy();
    expect(within(card).getByText("Usada por 1")).toBeTruthy();
    expect(within(card).getByText("v0.2.1")).toBeTruthy();
  });

  it("filters by channel and lists as a table", () => {
    render(
      <MessageTemplatesPanel channel="Correo" layout="list" lang="es" d={d} />
    );
    expect(screen.queryByText("Pánico · conductor")).toBeNull();
    const row = screen
      .getByRole("link", { name: "Pánico · torre" })
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("v0.1.0")).toBeTruthy();
  });
});
