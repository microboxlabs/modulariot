import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IntegrationConnection } from "@/features/integration-config/integration-config.types";
import LevelNotices from "./level-notices";
import type { Notice } from "./maintainer-api";

const d = {
  notices: "Avisos automáticos",
  addNoticeButton: "Agregar aviso",
  noNotices: "Sin avisos.",
  noticeSearch: "Buscar conexión",
  noticeNoMatch: "Ninguna conexión coincide.",
  noticeInactive: "inactiva",
  noticeConnection: "Conexión",
  pickConnection: "Elige una conexión",
  noticeNeedsConnection: "Elige la conexión de {kind}.",
  noticeKindWHATSAPP: "WhatsApp",
  noticeKindRESEND: "Correo",
  noticeKindCUSTOM_HTTP: "HTTP",
  recipientPhone: "Teléfono",
  close: "Cerrar",
};

const connection = (
  id: string,
  name: string,
  providerType: string,
  status = "ACTIVE"
) =>
  ({
    id,
    name,
    providerType,
    status,
    templateId: `tpl-${id}`,
  }) as IntegrationConnection;

const CONNECTIONS = [
  connection("w1", "WhatsApp torre", "WHATSAPP"),
  connection("w2", "WhatsApp antiguo", "WHATSAPP", "INACTIVE"),
  connection("m1", "Correo operaciones", "RESEND"),
  connection("h1", "Webhook Slack", "CUSTOM_HTTP"),
  connection("g1", "Posiciones GPS", "GPS_WEBHOOK"),
];

const renderIt = (notices: Notice[], onChange = vi.fn()) => {
  render(
    <LevelNotices
      notices={notices}
      connections={CONNECTIONS}
      lang="es"
      readOnly={false}
      d={d}
      onChange={onChange}
    />
  );
  return onChange;
};

describe("LevelNotices", () => {
  it("adds a notice through a connection picked by name, grouped by kind", () => {
    const onChange = renderIt([]);
    fireEvent.click(screen.getByText("Agregar aviso"));
    expect(screen.getByText("Correo")).toBeTruthy();
    expect(screen.queryByText("Posiciones GPS")).toBeNull();
    expect(
      (
        screen
          .getByText("WhatsApp antiguo")
          .closest("button") as HTMLButtonElement
      ).disabled
    ).toBe(true);

    fireEvent.change(screen.getByLabelText("Buscar conexión"), {
      target: { value: "slack" },
    });
    expect(screen.queryByText("WhatsApp torre")).toBeNull();
    fireEvent.click(screen.getByText("Webhook Slack"));
    expect(onChange).toHaveBeenCalledWith([
      {
        when: "open",
        kind: "CUSTOM_HTTP",
        connectionId: "h1",
        templateId: "tpl-h1",
        recipient: "",
      },
    ]);
  });

  it("asks a notice without a connection for one of its kind", () => {
    const onChange = renderIt([
      {
        when: "open",
        kind: "WHATSAPP",
        connectionId: null,
        templateId: null,
        recipient: null,
      },
    ]);
    expect(screen.getByText("Elige la conexión de WhatsApp.")).toBeTruthy();
    const select = screen.getByLabelText("Conexión");
    const options = within(select).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Elige una conexión",
      "WhatsApp torre",
      "WhatsApp antiguo",
    ]);
    expect(screen.getByPlaceholderText("Teléfono")).toBeTruthy();
    fireEvent.change(select, { target: { value: "w1" } });
    expect(onChange.mock.calls[0]?.[0][0]).toMatchObject({
      connectionId: "w1",
      templateId: "tpl-w1",
      kind: "WHATSAPP",
    });
  });
});
