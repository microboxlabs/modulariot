import { describe, expect, it } from "vitest";
import es from "@/lang/es.json";
import type { RuleFinding, RuleSpec } from "./conversations-types";
import { placeFindings, ruleFindingText } from "./rule-findings";
import { emptyStep } from "./rule-model";

const d = es.pages.userSettings.communications;

const finding = (
  section: string,
  code: string,
  params: Record<string, unknown> = {},
  severity: RuleFinding["severity"] = "ERROR"
): RuleFinding => ({
  section,
  severity,
  code,
  params,
  message: "mensaje del servidor",
  position: -1,
});

describe("ruleFindingText", () => {
  it("numbers the step from its section, one-based", () => {
    expect(ruleFindingText(finding("steps.0", "stepNoTemplate"), d)).toBe(
      "El paso 1 no tiene plantilla."
    );
    expect(
      ruleFindingText(
        finding("steps.2", "stepTemplateNoChannel", {
          template: "panic-tower",
          channel: "email",
        }),
        d
      )
    ).toBe("La plantilla panic-tower del paso 3 no tiene versión para Correo.");
  });

  it("prefers the server's step or entry number over the section", () => {
    expect(
      ruleFindingText(finding("steps.0", "stepNoTemplate", { step: 4 }), d)
    ).toBe("El paso 4 no tiene plantilla.");
    expect(
      ruleFindingText(finding("audience.0", "stepNoTemplate", { entry: 2 }), d)
    ).toBe("El paso 2 no tiene plantilla.");
    expect(
      ruleFindingText(finding("steps.1", "stepNoTemplate", { step: null }), d)
    ).toBe("El paso 2 no tiene plantilla.");
  });

  it("names the role by its label", () => {
    expect(
      ruleFindingText(
        finding("audience.0", "unknownRole", { role: "tower_lead" }, "WARNING"),
        d
      )
    ).toBe(
      "Ningún contacto tiene el rol Jefe de torre: este destinatario no recibirá mensajes."
    );
  });

  it("fills the condition's detail and falls back to the server's message", () => {
    expect(
      ruleFindingText(
        { ...finding("trigger", "whenInvalid", { detail: "falta )" }) },
        d
      )
    ).toBe("La condición no es válida: falta )");
    expect(ruleFindingText(finding("steps.0", "somethingNew"), d)).toBe(
      "mensaje del servidor"
    );
  });
});

describe("placeFindings", () => {
  const spec: RuleSpec = {
    trigger: { event: "symptom.case.opened", when: null },
    audience: [{ role: "driver" }, { role: "tower_lead" }],
    steps: [
      { ...emptyStep(), template: "" },
      {
        ...emptyStep(),
        template: "panic-tower",
        to: [
          { address: "tower@example.com", channel: "email", name: "Torre" },
          { role: "tower_lead" },
        ],
      },
    ],
  };

  it("puts each finding beside the control it is about", () => {
    const placed = placeFindings(
      [
        finding("trigger", "whenInvalid", { detail: "x" }),
        finding("audience.1", "unknownRole", { role: "tower_lead" }),
        finding("steps.0", "stepNoTemplate"),
        finding("steps.1", "unknownRole", { role: "TOWER_LEAD" }),
        finding("steps.1", "stepWaitNeedsReplies", { channel: "preferred" }),
      ],
      spec,
      d
    );
    expect(placed.trigger).toHaveLength(1);
    expect(Object.keys(placed.audience)).toEqual(["1"]);
    expect(placed.steps[0]).toMatchObject({
      template: true,
      channel: false,
      messages: ["El paso 1 no tiene plantilla."],
    });
    expect(placed.steps[1].template).toBe(false);
    expect(placed.steps[1].channel).toBe(true);
    expect(placed.steps[1].entries).toEqual({
      1: [
        "Ningún contacto tiene el rol Jefe de torre: este destinatario no recibirá mensajes.",
      ],
    });
  });

  it("keeps an audience finding with no row apart", () => {
    const placed = placeFindings(
      [finding("audience.0", "noAudience")],
      { ...spec, audience: [] },
      d
    );
    expect(placed.audienceGeneral).toEqual(["Falta decir a quién se escribe."]);
  });
});
