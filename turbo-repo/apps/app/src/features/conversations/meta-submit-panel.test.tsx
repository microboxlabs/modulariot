import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type {
  ConversationTemplate,
  MetaTemplate,
  TemplateBody,
  WhatsAppVariant,
} from "./conversations-types";

const api = vi.hoisted(() => ({
  createMetaTemplate: vi.fn(),
  editMetaTemplate: vi.fn(),
  previewTemplateEmail: vi.fn(),
  refreshMetaTemplates: vi.fn(),
  refreshTemplates: vi.fn(),
  saveTemplate: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import MetaSubmitPanel, {
  draftFromTemplate,
  metaSync,
} from "./meta-submit-panel";

const d = es.pages.userSettings.communications;

const TEXT = "Cuota de {{company}}: {{used}} de {{quota}} consultas.";
const VARIANT: WhatsAppVariant = {
  metaName: "quota_alert",
  language: "es",
  params: ["organization"],
};
const BODY: TemplateBody = {
  name: "Alerta de cuota",
  baseText: TEXT,
  whatsapp: VARIANT,
  email: null,
};
const ON_META: MetaTemplate = {
  id: "77",
  name: "quota_alert",
  language: "es",
  category: "UTILITY",
  status: "APPROVED",
  rejectedReason: null,
  parameterFormat: "NAMED",
  headerFormat: "TEXT",
  header: "Cuota",
  body: TEXT,
  footer: "ModularIoT",
  buttons: [],
  params: ["company", "used", "quota"],
  examples: { company: "Demo", used: "8", quota: "10" },
};

describe("metaSync", () => {
  it("submits a template Meta does not have, in that language", () => {
    expect(metaSync(VARIANT, TEXT, []).sync).toBe("create");
    expect(
      metaSync(VARIANT, TEXT, [{ ...ON_META, language: "es_CL" }]).sync
    ).toBe("create");
  });

  it("sends changes when the base text differs, and waits while Meta reviews", () => {
    expect(metaSync(VARIANT, TEXT, [ON_META]).sync).toBeNull();
    expect(metaSync(VARIANT, `${TEXT} Gracias.`, [ON_META]).sync).toBe(
      "update"
    );
    expect(
      metaSync(VARIANT, `${TEXT} Gracias.`, [{ ...ON_META, status: "PENDING" }])
        .sync
    ).toBeNull();
  });
});

describe("draftFromTemplate", () => {
  it("keeps Meta's header and footer on an edit and fills the examples", () => {
    const draft = draftFromTemplate(
      VARIANT,
      TEXT,
      "UTILITY",
      { used: "5" },
      ON_META
    );
    expect(draft).toMatchObject({
      name: "quota_alert",
      language: "es",
      header: "Cuota",
      footer: "ModularIoT",
      body: TEXT,
      examples: { company: "Demo", used: "5", quota: "10" },
    });
  });
});

function Harness({
  templates,
  start,
  body = BODY,
  onSaved,
}: Readonly<{
  templates: MetaTemplate[];
  start: Record<string, string>;
  body?: TemplateBody;
  onSaved: (saved: ConversationTemplate) => void;
}>) {
  const [examples, setExamples] = useState(start);
  const [busy, setBusy] = useState(false);
  return (
    <MetaSubmitPanel
      templateKey="quota_alert"
      body={body}
      variant={VARIANT}
      templates={templates}
      examples={examples}
      dirty={false}
      busy={busy}
      blocked={false}
      d={d}
      onExamples={setExamples}
      onBusyChange={setBusy}
      onSaved={onSaved}
    />
  );
}

describe("MetaSubmitPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createMetaTemplate.mockResolvedValue({ ...ON_META, status: "PENDING" });
    api.previewTemplateEmail.mockResolvedValue({
      subject: "Quota",
      html: "<p>Quota</p>",
      text: "Quota",
    });
    api.saveTemplate.mockResolvedValue({
      key: "quota_alert",
    } as ConversationTemplate);
  });

  it("submits the base text with an example per variable, then saves those variables", async () => {
    const onSaved = vi.fn();
    render(
      <Harness
        templates={[]}
        start={{ company: "Transportes Demo" }}
        onSaved={onSaved}
      />
    );
    const submit = screen.getByRole("button", {
      name: "Enviar a revisión de Meta",
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Ejemplo de used"), {
      target: { value: "800" },
    });
    fireEvent.change(screen.getByLabelText("Ejemplo de quota"), {
      target: { value: "1000" },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.createMetaTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "quota_alert",
        language: "es",
        category: "UTILITY",
        body: TEXT,
        examples: { company: "Transportes Demo", used: "800", quota: "1000" },
      })
    );
    expect(api.saveTemplate).toHaveBeenCalledWith("quota_alert", {
      ...BODY,
      whatsapp: { ...VARIANT, params: ["company", "used", "quota"] },
    });
  });

  it("shows nothing when Meta already has the same text", () => {
    const { container } = render(
      <Harness templates={[ON_META]} start={{}} onSaved={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("validates HTML before submitting to Meta", async () => {
    api.previewTemplateEmail.mockRejectedValue(
      new Error("Invalid HTML template")
    );
    render(
      <Harness
        templates={[]}
        start={ON_META.examples}
        onSaved={vi.fn()}
        body={{
          ...BODY,
          email: { subject: "Quota", body: null, html: "{{#if company}}open" },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: d.metaSubmitReview }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Invalid HTML template"
    );
    expect(api.createMetaTemplate).not.toHaveBeenCalled();
    expect(api.editMetaTemplate).not.toHaveBeenCalled();
    expect(api.saveTemplate).not.toHaveBeenCalled();
  });

  it("keeps an accepted Meta submission when the local save fails", async () => {
    const accepted = { ...ON_META, status: "PENDING" };
    api.saveTemplate.mockImplementation(() => {
      expect(api.refreshMetaTemplates).toHaveBeenCalledWith(accepted);
      return Promise.reject(new Error("Local save failed"));
    });
    const onSaved = vi.fn();
    const { rerender } = render(
      <Harness templates={[]} start={ON_META.examples} onSaved={onSaved} />
    );
    fireEvent.click(screen.getByRole("button", { name: d.metaSubmitReview }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Local save failed"
    );
    rerender(
      <Harness
        templates={[accepted]}
        start={ON_META.examples}
        onSaved={onSaved}
      />
    );
    expect(
      screen.queryByRole("button", { name: d.metaSubmitReview })
    ).toBeNull();
    expect(screen.getByRole("alert")).toHaveProperty(
      "textContent",
      "Local save failed"
    );
    expect(api.createMetaTemplate).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each<{ patch: Partial<MetaTemplate>; notice: string }>([
    {
      patch: { category: "AUTHENTICATION" },
      notice: d.metaLockedAuthentication,
    },
    { patch: { headerFormat: "IMAGE" }, notice: d.metaLockedMedia },
    {
      patch: { parameterFormat: "POSITIONAL" },
      notice: d.metaLockedPositional,
    },
  ])("keeps the catalog's edit restriction: $notice", ({ patch, notice }) => {
    render(
      <Harness
        templates={[{ ...ON_META, ...patch, body: "Different text" }]}
        start={{}}
        onSaved={vi.fn()}
      />
    );
    expect(screen.getByText(notice)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: d.metaSubmitReview })
    ).toBeNull();
    expect(api.createMetaTemplate).not.toHaveBeenCalled();
    expect(api.editMetaTemplate).not.toHaveBeenCalled();
  });
});
