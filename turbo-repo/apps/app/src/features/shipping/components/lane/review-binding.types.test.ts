import { describe, it, expect } from "vitest";
import {
  attachedChannels,
  bindingChannelKey,
  channelKey,
  conditionForTrigger,
  findTarget,
  REVIEW_EVENT_TYPE,
  REVIEW_SCOPE_KIND,
  targetKey,
  taskKeysForBoard,
  triggerFromCondition,
  unmappedRequiredFields,
  type DispatchTarget,
  type EventBinding,
} from "./review-binding.types";
import { renderTemplate } from "./review-integration.types";

/** A stored binding with sensible defaults, overridable per test. */
function binding(over: Partial<EventBinding>): EventBinding {
  return {
    id: "b-1",
    ownerOrgSlug: "mintral",
    inherited: false,
    eventType: REVIEW_EVENT_TYPE,
    scopeKind: REVIEW_SCOPE_KIND,
    scopeKey: "wfship:transportValidationTask",
    connectionId: "c-1",
    operationId: "o-1",
    matchCondition: {},
    fieldTemplates: {},
    enabled: true,
    updatedAt: "2026-07-24T00:00:00Z",
    updatedBy: "someone",
    ...over,
  };
}

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

describe("channel identity", () => {
  it("keys a channel on connection and operation", () => {
    expect(channelKey("c-1", "o-1")).toBe("c-1::o-1");
    // A null operation still yields a stable, distinct key.
    expect(channelKey("c-1", null)).toBe("c-1::");
  });

  it("derives a binding's channel key from its ids", () => {
    expect(bindingChannelKey(binding({ connectionId: "c-9", operationId: "o-9" }))).toBe(
      "c-9::o-9"
    );
  });
});

describe("attachedChannels", () => {
  it("folds a channel written across a board's task keys into one entry", () => {
    // monitoringFinalization aggregates several tasks; the same channel is written to
    // each, but the drawer must show it once.
    const [taskA, taskB] = taskKeysForBoard("monitoringFinalization");
    const channels = attachedChannels(
      [
        binding({ id: "a", scopeKey: taskA, connectionId: "c-1", operationId: "o-1" }),
        binding({ id: "b", scopeKey: taskB, connectionId: "c-1", operationId: "o-1" }),
      ],
      "monitoringFinalization"
    );

    expect(channels).toHaveLength(1);
    expect(bindingChannelKey(channels[0])).toBe("c-1::o-1");
  });

  it("keeps two distinct channels on the same column", () => {
    const channels = attachedChannels(
      [
        binding({ id: "a", connectionId: "c-1", operationId: "o-1" }),
        binding({ id: "b", connectionId: "c-2", operationId: "o-2" }),
      ],
      "transportValidation"
    );

    expect(channels.map(bindingChannelKey).sort()).toEqual(["c-1::o-1", "c-2::o-2"]);
  });

  it("prefers the org's own binding over an inherited one for the same channel", () => {
    const channels = attachedChannels(
      [
        binding({ id: "inh", inherited: true, ownerOrgSlug: "parent" }),
        binding({ id: "own", inherited: false }),
      ],
      "transportValidation"
    );

    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe("own");
  });

  it("ignores bindings from other events or scopes", () => {
    const channels = attachedChannels(
      [
        binding({ id: "other-event", eventType: "something.else" }),
        binding({ id: "other-scope", scopeKey: "unrelatedTask" }),
        binding({ id: "keep" }),
      ],
      "transportValidation"
    );

    expect(channels.map((c) => c.id)).toEqual(["keep"]);
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
