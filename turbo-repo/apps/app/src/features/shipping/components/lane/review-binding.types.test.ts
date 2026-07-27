import { describe, it, expect } from "vitest";
import {
  ALLOWED_ROOTS,
  checkCollectionTemplate,
  checkTemplate,
} from "./review-template-validation";
import {
  attachedChannels,
  bindNameOf,
  collectionFallbackRoot,
  collectionScopeOf,
  contractRoots,
  scopeOfRow,
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
import {
  collectionsInScope,
  renderTemplate,
} from "./review-integration.types";

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

describe("contractRoots", () => {
  const target = {
    connectionId: "c1",
    connectionName: "Partner API",
    providerType: "CUSTOM_HTTP",
    operationId: "o1",
    operationName: "Report verdict",
    method: "POST",
    path: "/verdict",
    fields: [],
  } as const;

  it("is null when the modulith does not report the contract's roots", () => {
    // Null is "unknown", never "the static four": guessing here is what made the drawer
    // reject {{reasons.code}} while the server accepted it.
    expect(contractRoots(target)).toBeNull();
    expect(contractRoots({ ...target, templateRoots: [] })).toBeNull();
    expect(contractRoots(undefined)).toBeNull();
  });

  it("is the reported set once the modulith sends it", () => {
    expect(
      contractRoots({ ...target, templateRoots: ["task", "content", "reasons"] })
    ).toEqual(["task", "content", "reasons"]);
  });

  it("lets a nested array's root through the check the save gate runs", () => {
    // The end-to-end path: no roots reported → the row and the gate both accept the
    // template the server would store.
    expect(
      checkTemplate("{{reasons.code}}", contractRoots(target)).status
    ).toBe("valid");
  });
});

describe("collection rows drive the drawer's scopes", () => {
  // The contract as the feed sends it: a collection row per array, then the rows it scopes.
  const target = {
    connectionId: "c1",
    connectionName: "Partner API",
    providerType: "CUSTOM_HTTP",
    operationId: "o1",
    operationName: "Report verdict",
    method: "POST",
    path: "/verdict",
    templateRoots: ["task", "content", "review", "session"],
    fields: [
      { id: "reference", type: "string", required: true, contextRoot: null, kind: "value" },
      { id: "items", type: "array", required: false, contextRoot: null, kind: "collection" },
      {
        id: "items.mediaId",
        type: "string",
        required: true,
        contextRoot: "content",
        kind: "value",
      },
      {
        id: "items.notes",
        type: "array",
        required: false,
        contextRoot: "content",
        kind: "collection",
      },
      {
        id: "items.notes.code",
        type: "string",
        required: true,
        // The contract alone cannot know better: with no itemsFrom it says content.
        contextRoot: "content",
        kind: "value",
      },
    ],
  } as const satisfies DispatchTarget;

  const mapped = {
    items: "{{content}}",
    "items.notes": "{{content.reasons}}",
  };

  it("reads a nested row's scope from the collection the draft names", () => {
    const nested = target.fields[4];
    // Without a mapping we can only repeat the contract's guess…
    expect(scopeOfRow(nested, target, {})).toBe("content");
    // …and once the operator names the collection, that decides it.
    expect(scopeOfRow(nested, target, mapped)).toBe("reasons");
  });

  it("picks the innermost enclosing collection, not the outermost", () => {
    expect(scopeOfRow(target.fields[2], target, mapped)).toBe("content");
    expect(scopeOfRow(target.fields[4], target, mapped)).toBe("reasons");
  });

  it("leaves an envelope row unscoped", () => {
    expect(scopeOfRow(target.fields[0], target, mapped)).toBeNull();
  });

  // The echo under a collection row states what its fields will read while it is unmapped.
  // Its own contextRoot is the scope it sits IN, which is null for a top-level array — using
  // that would drop the explanation exactly where an operator first meets one.
  it("tells a top-level collection what its fields read, though it sits in no scope", () => {
    const items = target.fields[1];
    expect(items.contextRoot).toBeNull();
    expect(collectionFallbackRoot(items, target)).toBe("content");
  });

  it("reads a nested collection's fallback off the rows it scopes, not the ones its parent does", () => {
    expect(collectionFallbackRoot(target.fields[3], target)).toBe("content");
  });

  it("returns null for a collection with no value rows of its own", () => {
    const empty = {
      ...target,
      fields: [{ id: "items", type: "array", required: false, kind: "collection" }],
    } as const satisfies DispatchTarget;
    expect(collectionFallbackRoot(empty.fields[0], empty)).toBeNull();
  });

  it("adds the draft's bind names to the roots the rows may read", () => {
    expect(contractRoots(target, {})).toEqual([
      "task",
      "content",
      "review",
      "session",
    ]);
    expect(contractRoots(target, mapped)).toContain("reasons");
  });

  it("keeps unknown roots unknown even when the draft declares some", () => {
    // Half-knowledge would look authoritative while still rejecting what the contract adds.
    const older = { ...target, templateRoots: undefined };
    expect(contractRoots(older, mapped)).toBeNull();
  });

  it("never demands a mapping for a collection row", () => {
    // Its source falls back to the contract's, so blocking a save on it would refuse a
    // mapping the server stores.
    const missing = unmappedRequiredFields(target, {}).map((field) => field.id);
    expect(missing).toEqual(["reference", "items.mediaId", "items.notes.code"]);
  });

  it("reads a collection row's bind name off its path's last segment", () => {
    expect(bindNameOf("{{content.reasons}}")).toBe("reasons");
    expect(bindNameOf("{{content}}")).toBe("content");
    expect(bindNameOf("content.reasons")).toBeNull();
    expect(bindNameOf(undefined)).toBeNull();
  });

  it("writes a collection's source in the scope it sits in, not the one it creates", () => {
    // The distinction that cost a live integration: `items.notes` is answered from inside
    // `items`, where the element is bound as `content` — so `content.reasons`. Reading its own
    // bind name instead gives `reasons`, which points the row at its own elements.
    expect(collectionScopeOf(target.fields[3], target, mapped)).toBe("content");
    expect(collectionScopeOf(target.fields[1], target, mapped)).toBeNull();
  });

  it("falls back to the contract's own root when the enclosing row is unmapped", () => {
    expect(collectionScopeOf(target.fields[3], target, {})).toBe("content");
  });
});

describe("collectionsInScope", () => {
  it("offers the reviewed items at the envelope and their reasons inside one", () => {
    expect(collectionsInScope(null).map((c) => c.path)).toEqual(["content"]);
    expect(collectionsInScope("content").map((c) => c.path)).toEqual([
      "content.reasons",
    ]);
  });

  it("never offers a scope its own bind name", () => {
    // `reasons` is what an element becomes, so a row scoped by it has no further array to
    // iterate — offering `{{reasons}}` is what produced an empty array and a dropped field.
    expect(collectionsInScope("reasons")).toEqual([]);
    for (const scope of [null, "content", "reasons"]) {
      expect(collectionsInScope(scope).map((c) => c.path)).not.toContain(scope);
    }
  });
});

describe("checkCollectionTemplate", () => {
  it("accepts a bare root, which a value row refuses", () => {
    expect(checkCollectionTemplate("{{content}}", ALLOWED_ROOTS).status).toBe("valid");
    expect(checkTemplate("{{content}}", ALLOWED_ROOTS).problem?.code).toBe("wholeObject");
  });

  it("accepts a dotted collection path", () => {
    const check = checkCollectionTemplate("{{content.reasons}}", ALLOWED_ROOTS);
    expect(check.status).toBe("valid");
    expect(check.paths).toEqual(["content.reasons"]);
  });

  it("refuses anything that is not a single path stash", () => {
    for (const bad of ["content.reasons", "{{a}} {{b}}", "{{helper x}}", "text", "{{}}"]) {
      expect(checkCollectionTemplate(bad, ALLOWED_ROOTS).problem?.code).toBe(
        "notCollection"
      );
    }
  });

  it("refuses a root the contract does not offer, and skips the check when unknown", () => {
    expect(checkCollectionTemplate("{{nope.things}}", ALLOWED_ROOTS).problem?.code).toBe(
      "unknownRoot"
    );
    expect(checkCollectionTemplate("{{nope.things}}", null).status).toBe("valid");
  });

  it("refuses an element bind name as a source, whatever the roots say", () => {
    // The one this rule exists for. `reasons` is a legal root *inside* the array it names —
    // the rows there read `{{reasons.code}}` — so the root check waves it through, and the
    // server does too: it resolves to nothing, renders `[]`, and an unrequired empty array is
    // dropped from the payload rather than reported. Green everywhere, field never sent.
    for (const roots of [ALLOWED_ROOTS, ["task", "content", "reasons"], null]) {
      expect(checkCollectionTemplate("{{reasons}}", roots).problem?.code).toBe(
        "elementRoot"
      );
    }
    expect(checkCollectionTemplate("{{reasons.code}}", null).problem?.code).toBe(
      "elementRoot"
    );
  });

  it("still accepts the path that names where those elements come from", () => {
    expect(checkCollectionTemplate("{{content.reasons}}", null).status).toBe("valid");
  });
});
