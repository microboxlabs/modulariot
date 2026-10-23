import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LevelNotices from "./level-notices";
import type { Notice } from "./maintainer-api";

const d = {
  notices: "Avisos automáticos",
  addNoticeButton: "Agregar aviso",
  noNotices: "Sin avisos.",
  noticeSearch: "Buscar canal",
  noticeNoMatch: "Ningún canal coincide.",
  noticeChannel: "Canal",
  noticeRecipient: "A quién",
  noticeUnknownChannel: "El canal «{channel}» ya no existe.",
  channelEmail: "Correo",
  channelWhatsapp: "WhatsApp",
  channelTeams: "Teams",
  channelSlack: "Slack",
  channelWebhook: "Webhook",
  recipientPhone: "Teléfono",
  recipientChannel: "Canal o grupo",
  close: "Cerrar",
};

const renderIt = (notices: Notice[], onChange = vi.fn()) => {
  render(
    <LevelNotices
      notices={notices}
      readOnly={false}
      d={d}
      onChange={onChange}
    />
  );
  return onChange;
};

describe("LevelNotices", () => {
  it("adds a notice on a channel type found by name", () => {
    const onChange = renderIt([]);
    fireEvent.click(screen.getByText("Agregar aviso"));
    fireEvent.change(screen.getByLabelText("Buscar canal"), {
      target: { value: "sla" },
    });
    expect(screen.queryByText("Correo")).toBeNull();
    fireEvent.click(screen.getByText("Slack"));
    expect(onChange).toHaveBeenCalledWith([
      { when: "reach", channel: "slack", channelId: null, recipient: "" },
    ]);
  });

  it("asks for the recipient its channel type needs, and none for a webhook", () => {
    renderIt([
      { when: "open", channel: "whatsapp", channelId: null, recipient: null },
      { when: "close", channel: "webhook", channelId: null, recipient: null },
    ]);
    expect(screen.getAllByLabelText("A quién")).toHaveLength(1);
    expect(screen.getByPlaceholderText("Teléfono")).toBeTruthy();
  });

  it("flags a channel type that no longer exists", () => {
    renderIt([
      { when: "open", channel: "app", channelId: null, recipient: null },
    ]);
    expect(screen.getByText("El canal «app» ya no existe.")).toBeTruthy();
    expect(
      (screen.getByLabelText("Canal") as HTMLSelectElement).className
    ).toContain("border-red-500");
  });
});
