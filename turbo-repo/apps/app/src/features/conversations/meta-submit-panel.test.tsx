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
  onSaved,
}: Readonly<{
  templates: MetaTemplate[];
  start: Record<string, string>;
  onSaved: (saved: ConversationTemplate) => void;
}>) {
  const [examples, setExamples] = useState(start);
  return (
    <MetaSubmitPanel
      templateKey="quota_alert"
      body={BODY}
      variant={VARIANT}
      templates={templates}
      examples={examples}
      dirty={false}
      d={d}
      onExamples={setExamples}
      onSaved={onSaved}
    />
  );
}

describe("MetaSubmitPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createMetaTemplate.mockResolvedValue({ ...ON_META, status: "PENDING" });
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
});
