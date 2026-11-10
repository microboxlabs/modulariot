import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailVariant, TemplateBody } from "./conversations-types";

const api = vi.hoisted(() => ({ previewTemplateEmail: vi.fn() }));
vi.mock("./conversations-api", () => api);

import {
  TeamsCardPreview,
  chatText,
  useEmailPreview,
} from "./template-previews";

describe("chatText", () => {
  it("keeps the formatting characters sent by the connection channels", () => {
    const body: TemplateBody = {
      name: "Quota",
      baseText: "*{{company}}*: _usage_",
      whatsapp: null,
      email: null,
    };
    expect(chatText(body, { company: "Example" }, "Email text")).toBe(
      "*Example*: _usage_"
    );
    expect(chatText({ ...body, baseText: "" }, {}, "Email text")).toBe(
      "Email text"
    );
  });
});

describe("useEmailPreview", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("clears the previous preview when the HTML is removed", async () => {
    vi.useFakeTimers();
    api.previewTemplateEmail.mockResolvedValue({
      subject: "Quota",
      html: "<p>Example</p>",
      text: "Example",
    });
    const email: EmailVariant = {
      subject: "Quota",
      body: null,
      html: "<p>{{company}}</p>",
    };
    const { result, rerender } = renderHook(
      ({ draft }: { draft: EmailVariant | null }) =>
        useEmailPreview(draft, { company: "Example" }),
      { initialProps: { draft: email as EmailVariant | null } }
    );
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(result.current.data?.text).toBe("Example");
    rerender({ draft: { ...email, html: "" } });
    expect(result.current.data).toBeUndefined();
    rerender({ draft: null });
    expect(result.current.data).toBeUndefined();
    expect(api.previewTemplateEmail).toHaveBeenCalledTimes(1);
  });
});

describe("TeamsCardPreview", () => {
  it("fills the card and leaves out optional facts without a value", () => {
    render(
      <TeamsCardPreview
        card={{
          title: "Pedido {{order}}",
          subtitle: "{{author}}",
          text: "Salió de bodega",
          facts: [
            { title: "Motivo", value: "{{reason}}", optional: true },
            { title: "Pedido", value: "{{order}}" },
          ],
          notes: ["Salida: {{departure}}"],
          actions: [{ title: "Ver", url: "https://app.example.com/{{order}}" }],
        }}
        values={{
          order: "4521",
          author: "Ana",
          reason: "-",
          departure: "08:00",
        }}
        d={{ previewTeamsLabel: "Tarjeta" }}
      />
    );
    expect(screen.getByText("Pedido 4521")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("4521")).toBeTruthy();
    expect(screen.queryByText("Motivo")).toBeNull();
    expect(screen.getByText("Salida: 08:00")).toBeTruthy();
    expect(screen.getByText("Ver")).toBeTruthy();
  });

  it("leaves out an optional fact and a button whose variables have no example", () => {
    render(
      <TeamsCardPreview
        card={{
          title: "Pedido",
          facts: [{ title: "Motivo", value: "{{reason}}", optional: true }],
          actions: [{ title: "Ver", url: "{{link}}" }],
        }}
        values={{}}
        d={{ previewTeamsLabel: "Tarjeta" }}
      />
    );
    expect(screen.queryByText("Motivo")).toBeNull();
    expect(screen.queryByText("Ver")).toBeNull();
  });
});
