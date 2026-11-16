import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailVariant, TemplateBody } from "./conversations-types";

const api = vi.hoisted(() => ({
  previewTemplateEmail: vi.fn(),
  previewTemplateTeams: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import es from "@/lang/es.json";
import {
  TeamsCardPreview,
  chatText,
  useEmailPreview,
} from "./template-previews";

const d = es.pages.userSettings.communications;

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
  const CARD = {
    title: "Pedido {{order}}",
    facts: [{ title: "Pedido", value: "{{order}}" }],
    actions: [{ title: "Ver", url: "https://app.example.com/{{order}}" }],
  };
  const SENT = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: "Pedido 4521", weight: "Bolder" },
            { type: "FactSet", facts: [{ title: "Pedido", value: "4521" }] },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Ver",
              url: "https://app.example.com/4521",
            },
          ],
        },
      },
    ],
  };

  it("draws the card the backend builds for the step, buttons included", async () => {
    api.previewTemplateTeams.mockResolvedValue(SENT);
    render(<TeamsCardPreview card={CARD} values={{ order: "4521" }} d={d} />);
    expect(
      await screen.findByText("Pedido 4521", {}, { timeout: 2000 })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver" })).toBeTruthy();
    expect(screen.getByText(d.previewTeamsSender)).toBeTruthy();
    expect(api.previewTemplateTeams).toHaveBeenCalledWith(CARD, {
      order: "4521",
    });
  });

  it("says when the card cannot be drawn", async () => {
    api.previewTemplateTeams.mockRejectedValue(new Error("title is required"));
    render(<TeamsCardPreview card={CARD} values={{}} d={d} />);
    expect(
      await screen.findByText(/title is required/, {}, { timeout: 2000 })
    ).toBeTruthy();
  });
});
