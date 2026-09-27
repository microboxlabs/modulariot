import { describe, expect, it } from "vitest";
import {
  draftFrom,
  monthPeriod,
  toRequest,
  withDefault,
  type ProviderDraft,
} from "./model-provider-form";

function draft(patch: Partial<ProviderDraft> = {}): ProviderDraft {
  return {
    provider: "deepseek",
    apiKey: "sk-new",
    baseUrl: "",
    enabled: true,
    models: [
      {
        rowKey: "r",
        id: "deepseek-chat",
        inputPerMtok: "0.27",
        outputPerMtok: "1.10",
        isDefault: true,
      },
    ],
    ...patch,
  };
}

describe("toRequest", () => {
  it("builds the body with numeric prices and drops blank rows", () => {
    const result = toRequest(
      draft({
        models: [
          ...draft().models,
          {
            rowKey: "r",
            id: "",
            inputPerMtok: "",
            outputPerMtok: "",
            isDefault: false,
          },
          {
            rowKey: "r",
            id: "deepseek-reasoner",
            inputPerMtok: "",
            outputPerMtok: "",
            isDefault: false,
          },
        ],
      }),
      true
    );

    expect(result).toEqual({
      ok: true,
      value: {
        apiKey: "sk-new",
        baseUrl: null,
        enabled: true,
        models: [
          {
            id: "deepseek-chat",
            inputPerMtok: 0.27,
            outputPerMtok: 1.1,
            default: true,
          },
          {
            id: "deepseek-reasoner",
            inputPerMtok: null,
            outputPerMtok: null,
            default: false,
          },
        ],
      },
    });
  });

  it("needs a key for a new provider but keeps the stored one on edit", () => {
    expect(toRequest(draft({ apiKey: " " }), true)).toEqual({
      ok: false,
      error: "apiKey",
    });
    const edit = toRequest(draft({ apiKey: "" }), false);
    expect(edit.ok && edit.value.apiKey).toBe("");
  });

  it.each([
    [{ provider: "" }, "provider"],
    [{ baseUrl: "http://plain.example" }, "baseUrl"],
    [
      {
        models: [
          {
            rowKey: "r",
            id: "",
            inputPerMtok: "1",
            outputPerMtok: "",
            isDefault: false,
          },
        ],
      },
      "modelId",
    ],
    [
      {
        models: [
          {
            rowKey: "r",
            id: "m",
            inputPerMtok: "",
            outputPerMtok: "",
            isDefault: false,
          },
          {
            rowKey: "r",
            id: "m",
            inputPerMtok: "",
            outputPerMtok: "",
            isDefault: false,
          },
        ],
      },
      "duplicateModel",
    ],
    [
      {
        models: [
          {
            rowKey: "r",
            id: "m",
            inputPerMtok: "-1",
            outputPerMtok: "",
            isDefault: false,
          },
        ],
      },
      "price",
    ],
    [
      {
        models: [
          {
            rowKey: "r",
            id: "m",
            inputPerMtok: "abc",
            outputPerMtok: "",
            isDefault: false,
          },
        ],
      },
      "price",
    ],
  ] as const)("refuses %j with %s", (patch, error) => {
    expect(toRequest(draft(patch as Partial<ProviderDraft>), true)).toEqual({
      ok: false,
      error,
    });
  });
});

describe("draftFrom", () => {
  it("starts an edit with a blank key and prices as text", () => {
    const d = draftFrom({
      provider: "openai",
      baseUrl: null,
      keyPreview: "…abcd",
      enabled: false,
      models: [
        {
          id: "gpt-5",
          inputPerMtok: 1.25,
          outputPerMtok: null,
          default: false,
        },
      ],
      updatedBy: null,
      updatedAt: null,
    });

    expect(d.apiKey).toBe("");
    expect(d.enabled).toBe(false);
    expect(d.models[0]).toMatchObject({
      id: "gpt-5",
      inputPerMtok: "1.25",
      outputPerMtok: "",
      isDefault: false,
    });
  });
});

describe("withDefault", () => {
  it("keeps at most one default and toggles it off on a second click", () => {
    const rows = draft({
      models: [
        {
          rowKey: "r",
          id: "a",
          inputPerMtok: "",
          outputPerMtok: "",
          isDefault: true,
        },
        {
          rowKey: "r",
          id: "b",
          inputPerMtok: "",
          outputPerMtok: "",
          isDefault: false,
        },
      ],
    }).models;

    expect(withDefault(rows, 1).map((m) => m.isDefault)).toEqual([false, true]);
    expect(withDefault(rows, 0).map((m) => m.isDefault)).toEqual([
      false,
      false,
    ]);
  });
});

describe("monthPeriod", () => {
  it("covers the calendar month in UTC, across a year boundary", () => {
    const now = new Date("2026-01-15T12:00:00Z");

    expect(monthPeriod(0, now)).toEqual({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    });
    expect(monthPeriod(-1, now)).toEqual({
      from: "2025-12-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    });
  });
});
