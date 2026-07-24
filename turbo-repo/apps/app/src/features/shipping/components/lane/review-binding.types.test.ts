import { describe, it, expect } from "vitest";
import {
  conditionForTrigger,
  findTarget,
  REVIEW_EVENT_TYPE,
  REVIEW_SCOPE_KIND,
  targetKey,
  taskKeysForBoard,
  triggerFromCondition,
  unmappedRequiredFields,
  type DispatchTarget,
} from "./review-binding.types";
import { renderTemplate } from "./review-integration.types";

const target: DispatchTarget = {
  connectionId: "c-1",
  connectionName: "Partner API",
  providerType: "CUSTOM_HTTP",
  operationId: "o-1",
  operationName: "ActualizarEstado",
  method: "POST",
  path: "/v1/estado",
  fields: [
    { id: "guidMultimedia", type: "string", required: true },
    { id: "aprobado", type: "boolean", required: true },
    { id: "mensaje", type: "string", required: false },
  ],
};

describe("scope", () => {
  it("binds on the Activiti task, not the board label", () => {
    expect(REVIEW_SCOPE_KIND).toBe("activiti_task");
    expect(REVIEW_EVENT_TYPE).toBe("review.verdict");
  });

  it("resolves every task that feeds a board", () => {
    // monitoringFinalization is fed by several workflow tasks; each needs its own
    // binding or one of them silently never fires.
    const keys = taskKeysForBoard("monitoringFinalization");

    expect(keys).toContain("wfship:tripOutsideInitiatedTask");
    expect(keys).toContain("tripInitiatedWithoutSovos");
    expect(keys.length).toBeGreaterThan(1);
  });

  it("maps a single-task board to exactly that task", () => {
    expect(taskKeysForBoard("transportValidation")).toEqual([
      "wfship:transportValidationTask",
    ]);
  });

  it("falls back to the board key when it is already a task key", () => {
    expect(taskKeysForBoard("someUnmappedTask")).toEqual(["someUnmappedTask"]);
  });
});

describe("trigger ↔ condition", () => {
  it("expresses rejections-only as a condition on the verdict", () => {
    expect(conditionForTrigger("on_reject")).toEqual({ "review.verdict": false });
  });

  it("expresses everything as the absence of a condition", () => {
    expect(conditionForTrigger("on_review")).toEqual({});
  });

  it("round-trips", () => {
    expect(triggerFromCondition(conditionForTrigger("on_reject"))).toBe("on_reject");
    expect(triggerFromCondition(conditionForTrigger("on_review"))).toBe("on_review");
  });

  it("reads a stored condition whose value is text", () => {
    // The backend compares as text, so a hand-written "false" must round-trip too.
    expect(triggerFromCondition({ "review.verdict": "false" })).toBe("on_reject");
  });

  it("treats an absent condition as every verdict", () => {
    expect(triggerFromCondition(undefined)).toBe("on_review");
    expect(triggerFromCondition({})).toBe("on_review");
  });
});

describe("unmappedRequiredFields", () => {
  it("passes when every required field has a template", () => {
    expect(
      unmappedRequiredFields(target, {
        guidMultimedia: "{{content.mediaId}}",
        aprobado: "{{review.verdict}}",
      })
    ).toEqual([]);
  });

  it("flags a required field left blank or absent", () => {
    expect(
      unmappedRequiredFields(target, { guidMultimedia: "   ", aprobado: "x" }).map(
        (f) => f.id
      )
    ).toEqual(["guidMultimedia"]);
  });

  it("ignores optional fields", () => {
    expect(
      unmappedRequiredFields(target, {
        guidMultimedia: "a",
        aprobado: "b",
        mensaje: "",
      })
    ).toEqual([]);
  });

  it("has nothing to check without a channel", () => {
    expect(unmappedRequiredFields(undefined, {})).toEqual([]);
  });
});

describe("target identity", () => {
  it("keys on connection and operation together", () => {
    // One connection can expose several operations; they are different channels.
    expect(targetKey(target)).toBe("c-1::o-1");
  });

  it("finds a target by its connection and operation", () => {
    expect(findTarget([target], "c-1", "o-1")).toBe(target);
    expect(findTarget([target], "c-1", "other")).toBeUndefined();
    expect(findTarget([target], null, "o-1")).toBeUndefined();
  });
});

describe("renderTemplate (preview)", () => {
  const context = {
    content: { mediaId: "19f8-a8ad" },
    review: { verdict: false, comment: "a & b" },
    task: { serviceCode: "SRV-1" },
  };

  it("substitutes a variable and interpolates around it", () => {
    expect(renderTemplate("{{content.mediaId}}", context)).toBe("19f8-a8ad");
    expect(renderTemplate("svc {{task.serviceCode}}!", context)).toBe("svc SRV-1!");
  });

  it("tolerates whitespace and renders non-strings by value", () => {
    expect(renderTemplate("{{  review.verdict  }}", context)).toBe("false");
  });

  it("renders a missing path as empty", () => {
    expect(renderTemplate("{{task.nope}}", context)).toBe("");
  });

  it("does not HTML-escape — the payload is JSON, not markup", () => {
    // Escaping here would misreport what the partner actually receives.
    expect(renderTemplate("{{review.comment}}", context)).toBe("a & b");
  });

  it("leaves a whole-object reference verbatim rather than showing [object Object]", () => {
    // The server rejects {{task}}; previewing a plausible-looking value for a
    // template that cannot be stored is exactly the divergence to avoid.
    expect(renderTemplate("{{task}}", context)).toBe("{{task}}");
  });

  it("leaves unsupported syntax verbatim so the operator sees what will be rejected", () => {
    expect(renderTemplate("{{#if review.verdict}}x{{/if}}", context)).toBe(
      "{{#if review.verdict}}x{{/if}}"
    );
  });
});
